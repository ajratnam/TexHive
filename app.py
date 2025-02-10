from flask import Flask, render_template, send_file
from flask_socketio import SocketIO, emit
import os
import subprocess

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Ensure 'temp' directory exists
TEMP_DIR = "temp"
os.makedirs(TEMP_DIR, exist_ok=True)

# Store document state
document_content = {"document.tex": ""}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/pdf')
def serve_pdf():
    pdf_path = os.path.join(TEMP_DIR, "document.pdf")
    return send_file(pdf_path, mimetype="application/pdf")


@socketio.on('update_text')
def handle_text_update(data):
    document_content["document.tex"] = data['content']
    emit('update_text', data, broadcast=True, include_self=False)  # Avoid self-reset


@socketio.on('compile_latex')
def compile_latex():
    tex_file = os.path.join(TEMP_DIR, "document.tex")

    with open(tex_file, "w") as f:
        f.write(document_content["document.tex"])

    subprocess.run(["pdflatex", "-interaction=nonstopmode", "-output-directory=" + TEMP_DIR, tex_file])

    emit('compilation_done', {'status': 'success'}, broadcast=True)


if __name__ == '__main__':
    socketio.run(app, debug=True)
