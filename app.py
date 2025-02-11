import textwrap

from flask import Flask, render_template, Response
from flask_socketio import SocketIO, emit
import os
import subprocess
import re
import requests
import ast

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


def get_language(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".py":
        return "python"
    elif ext in [".cpp", ".cc", ".cxx"]:
        return "cpp"
    elif ext == ".c":
        return "c"
    elif ext == ".js":
        return "javascript"
    elif ext in [".html", ".htm"]:
        return "html"
    elif ext == ".css":
        return "css"
    elif ext == ".java":
        return "java"
    else:
        return "text"


def get_source_segment(source, node):
    lines = source.splitlines()
    if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
        return "\n".join(lines[node.lineno - 1: node.end_lineno])
    else:
        return "Source segment not available."


def extract_code_with_ast(file_text, selector):
    try:
        tree = ast.parse(file_text)
    except Exception as e:
        return f"Error parsing file: {str(e)}"

    if '.' in selector:
        class_name, member_name = selector.split('.', 1)
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name == class_name:
                for subnode in node.body:
                    if isinstance(subnode, (ast.FunctionDef, ast.AsyncFunctionDef)) and subnode.name == member_name:
                        return get_source_segment(file_text, subnode)
                    if isinstance(subnode, ast.Assign):
                        for target in subnode.targets:
                            if isinstance(target, ast.Name) and target.id == member_name:
                                return get_source_segment(file_text, subnode)
                return f"Member '{member_name}' not found in class '{class_name}'."
        return f"Class '{class_name}' not found."
    else:
        for node in tree.body:
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and getattr(node, 'name', None) == selector:
                return get_source_segment(file_text, node)
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == selector:
                        return get_source_segment(file_text, node)
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                for subnode in node.body:
                    if isinstance(subnode, (ast.FunctionDef, ast.AsyncFunctionDef)) and subnode.name == selector:
                        return get_source_segment(file_text, subnode)
                    if isinstance(subnode, ast.Assign):
                        for target in subnode.targets:
                            if isinstance(target, ast.Name) and target.id == selector:
                                return get_source_segment(file_text, subnode)
        return f"Element '{selector}' not found."


def ensure_minted_package(content):
    if '\\usepackage{minted}' not in content:
        content = content.replace('\\begin{document}', '\\usepackage{minted}\n\\begin{document}', 1)
    return content


def process_github_commands(content):
    pattern = r'\\Github\{([^}]*)\}'

    def replace_func(match):
        arg = match.group(1).strip()
        code_snippet = ""
        language = "text"
        try:
            if arg.startswith("http://") or arg.startswith("https://"):
                url_pattern = r'(https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/([^#]+))(#L(\d+)-L(\d+))?'
                m = re.match(url_pattern, arg)
                if m:
                    user = m.group(2)
                    repo = m.group(3)
                    branch = m.group(4)
                    file_path = m.group(5)
                    lstart = m.group(7)
                    lend = m.group(8)
                    raw_url = f"https://raw.githubusercontent.com/{user}/{repo}/{branch}/{file_path}"
                    r = requests.get(raw_url)
                    if r.status_code == 200:
                        file_text = r.text
                        if lstart and lend:
                            file_lines = file_text.splitlines()
                            start_line = int(lstart)
                            end_line = int(lend)
                            code_snippet = "\n".join(file_lines[start_line - 1:end_line])
                        else:
                            code_snippet = file_text
                        language = get_language(file_path)
                    else:
                        code_snippet = f"Error fetching file: HTTP {r.status_code}"
                else:
                    code_snippet = "Invalid GitHub URL format."
            else:
                if '#' in arg:
                    file_part, selector = arg.split('#', 1)
                    parts = file_part.split('/')
                    if len(parts) < 4:
                        return "Invalid GitHub shorthand format."
                    user, repo, branch = parts[0], parts[1], parts[2]
                    file_path = "/".join(parts[3:])
                    raw_url = f"https://raw.githubusercontent.com/{user}/{repo}/{branch}/{file_path}"
                    r = requests.get(raw_url)
                    if r.status_code == 200:
                        file_text = r.text
                        code_snippet = extract_code_with_ast(file_text, selector)
                        language = get_language(file_path)
                        for i in range(selector.count('.')):
                            code_snippet = textwrap.dedent(code_snippet)
                    else:
                        code_snippet = f"Error fetching file: HTTP {r.status_code}"
                else:
                    code_snippet = "Invalid GitHub shorthand format."
        except Exception as e:
            code_snippet = f"Error processing \\Github command: {str(e)}"

        minted_block = (
            "\\begin{minted}[fontsize=\\footnotesize, breaklines, breakanywhere]{" + language + "}\n" +
            code_snippet +
            "\n\\end{minted}"
        )

        return minted_block

    new_content = re.sub(pattern, replace_func, content)
    new_content = ensure_minted_package(new_content)
    return new_content


@socketio.on('compile_latex')
def compile_latex(data=None):
    ignore_warnings = False
    if data and 'ignoreWarnings' in data:
        ignore_warnings = data['ignoreWarnings']

    tex_file = os.path.join(TEMP_DIR, "document.tex")
    processed_content = process_github_commands(document_content["document.tex"])
    with open(tex_file, "w") as f:
        f.write(processed_content)

    process = subprocess.run(
        ["pdflatex", "-shell-escape", "-interaction=nonstopmode", "document.tex"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=TEMP_DIR
    )

    logs = process.stdout.decode() + process.stderr.decode()

    if process.returncode != 0 and not ignore_warnings:
        status = "error"
    else:
        status = "success"

    emit('compilation_done', {'status': status, 'logs': logs}, broadcast=True)



if __name__ == '__main__':
    socketio.run(app, debug=True)
