import os
from flask import Blueprint, render_template, Response, request, redirect, url_for, jsonify
from core.config import Config
import firebase_admin
from firebase_admin import credentials, auth

bp = Blueprint('main', __name__)
   
cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'credentials.json'))
firebase_admin.initialize_app(cred)

@bp.route('/')
def index():
    return render_template('index.html')

@bp.route('/pdf')
def serve_pdf():
    pdf_file = request.args.get('file', 'document.pdf')
    pdf_path = os.path.join(Config.TEMP_DIR, pdf_file)
    if not os.path.exists(pdf_path):
        return "No PDF available", 404

    with open(pdf_path, "rb") as pdf_file_obj:
        response = Response(pdf_file_obj.read(), mimetype="application/pdf")
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

@bp.route('/verify-token', methods=['POST'])
def verify_token():
    token = request.json.get('token')
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        return {"status": "success", "uid": uid}, 200
    except Exception as e:
        return {"status": "error", "message": str(e)}, 401

@bp.route('/login')
def login():
    return render_template('login.html')

@bp.route('/is-authenticated')
def is_authenticated():
    token = request.args.get('token')
    if not token:
        return jsonify({"authenticated": False}), 401
    try:
        auth.verify_id_token(token)
        return jsonify({"authenticated": True}), 200
    except:
        return jsonify({"authenticated": False}), 401

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('token')
        if not token:
            return redirect(url_for('main.login'))
        try:
            auth.verify_id_token(token)
        except:
            return redirect(url_for('main.login'))
        return f(*args, **kwargs)
    return decorated_function
