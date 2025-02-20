import os
from flask import Blueprint, render_template, Response, request
from core.config import Config

bp = Blueprint('main', __name__)


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
