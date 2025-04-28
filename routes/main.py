import os
from urllib.parse import urlparse, parse_qs

from flask import Blueprint, render_template, Response, request, redirect, url_for, jsonify
from core.config import Config
import firebase_admin
from firebase_admin import credentials, auth
from functools import wraps

bp = Blueprint('main', __name__)
   
cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'credentials.json'))
firebase_admin.initialize_app(cred)


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('token')
        if not token:
            return redirect(url_for('main.login'))
        try:
            uid = auth.verify_id_token(token)['uid']
        except:
            return redirect(url_for('main.login'))
        return f(*args, **kwargs, uid=uid)
    return decorated_function


def project_required(required=True):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            referrer = request.referrer
            if referrer:
                query = urlparse(referrer).query
                params = parse_qs(query)
                project = params.get('project', [""])[0]
            else:
                project = ""

            if required and not project:
                return redirect(url_for("main.index"))

            return f(*args, **kwargs, project=project)

        return decorated_function

    if callable(required):
        f = required
        required = True
        return decorator(f)

    return decorator


@bp.route('/')
@login_required
def index(uid):
    (Config.DATA_DIR / uid).mkdir(exist_ok=True)
    return render_template('projects.html')


@bp.route('/editor')
@login_required
def editor(uid):
    (Config.DATA_DIR / uid).mkdir(exist_ok=True)
    project_name = request.args.get('project')
    if not project_name:
        return "Project name is required", 400
    project_dir = Config.DATA_DIR / uid / project_name
    if not os.path.exists(project_dir):
        return "Project does not exist", 404
    return render_template('editor.html')


@bp.route('/pdf')
@login_required
@project_required
def serve_pdf(uid, project):
    pdf_file = request.args.get('file', 'document.pdf')
    pdf_path = os.path.join(Config.TEMP_DIR / uid / project, pdf_file)
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


@bp.route('/logout')
def logout():
    response = redirect(url_for('main.login'))
    try:
        token = request.cookies.get('token')
        if token:
            # Revoke the refresh tokens for the user
            decoded_token = auth.verify_id_token(token)
            uid = decoded_token['uid']
            auth.revoke_refresh_tokens(uid)
            print(f"Refresh tokens revoked for user: {uid}")
        # Clear the token cookie
        response.delete_cookie('token')
    except Exception as e:
        print(f"Error revoking token: {e}")
    return response
