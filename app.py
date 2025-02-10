from flask import Flask, render_template, send_file
from flask_socketio import SocketIO, emit
import subprocess

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store document state
document_content = {"document.tex": ""}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/pdf')
def serve_pdf():
    return send_file("document.pdf", mimetype="application/pdf")


@socketio.on('update_text')
def handle_text_update(data):
    document_content["document.tex"] = data['content']
    emit('update_text', data, broadcast=True, include_self=False)  # Avoid self-reset


@socketio.on('compile_latex')
def compile_latex():
    tex_content = document_content["document.tex"]

    with open("document.tex", "w") as f:
        f.write(tex_content)

    subprocess.run(["pdflatex", "-interaction=nonstopmode", "document.tex"])

    emit('compilation_done', {'status': 'success'}, broadcast=True)


if __name__ == '__main__':
    socketio.run(app, debug=True)
