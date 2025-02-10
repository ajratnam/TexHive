from flask import Flask, render_template, send_file, Response, request
from flask_socketio import SocketIO, emit
import os
import subprocess

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)

document_content = {"document.tex": ""}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/pdf')
def serve_pdf():
    pdf_path = os.path.join(TEMP_DIR, "document.pdf")
    if not os.path.exists(pdf_path):
        return "No PDF available", 404

    with open(pdf_path, "rb") as pdf_file:
        response = Response(pdf_file.read(), mimetype="application/pdf")
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


@socketio.on('update_text')
def handle_text_update(data):
    document_content["document.tex"] = data['content']
    emit('update_text', data, broadcast=True, include_self=False)


@socketio.on('compile_latex')
def compile_latex():
    tex_file = os.path.join(TEMP_DIR, "document.tex")

    with open(tex_file, "w") as f:
        f.write(document_content["document.tex"])

    process = subprocess.run(
        ["pdflatex", "-interaction=nonstopmode", "-output-directory=" + TEMP_DIR, tex_file],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )

    logs = process.stdout.decode() + process.stderr.decode()

    # Check if pdflatex returned an error.
    if process.returncode != 0:
        status = "error"
    else:
        status = "success"

    emit('compilation_done', {'status': status, 'logs': logs}, broadcast=True)


if __name__ == '__main__':
    socketio.run(app, debug=True)
