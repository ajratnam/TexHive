import os, subprocess, re, requests, ast, json, textwrap, shutil
from flask import Flask, render_template, Response, request
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# Directories for source (DATA_DIR) and for compilation (TEMP_DIR)
DATA_DIR = "data"
TEMP_DIR = "temp"
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)


#############################
#  File System API Endpoints (operating in DATA_DIR)
#############################
def get_file_tree(directory):
    tree = []
    for entry in os.scandir(directory):
        rel_path = os.path.relpath(entry.path, DATA_DIR)
        if entry.is_dir():
            tree.append({
                'name': entry.name,
                'path': rel_path,
                'isDirectory': True,
                'children': get_file_tree(entry.path)
            })
        else:
            tree.append({
                'name': entry.name,
                'path': rel_path,
                'isDirectory': False
            })
    return tree


@app.route('/api/files', methods=['GET'])
def api_files():
    tree = get_file_tree(DATA_DIR)
    return json.dumps(tree)


@app.route('/api/file', methods=['GET'])
def api_get_file():
    path = request.args.get('path')
    if not path:
        return "Path parameter missing", 400
    abs_path = os.path.join(DATA_DIR, path)
    if not os.path.realpath(abs_path).startswith(os.path.realpath(DATA_DIR)):
        return "Invalid path", 400
    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
        return "File not found", 404
    with open(abs_path, 'r', encoding='utf-8') as f:
        content = f.read()
    return json.dumps({'path': path, 'content': content})


@app.route('/api/file', methods=['POST'])
def api_post_file():
    data = request.get_json()
    if not data or 'path' not in data or 'content' not in data:
        return "Missing data", 400
    path = data['path']
    content = data['content']
    abs_path = os.path.join(DATA_DIR, path)
    if not os.path.realpath(abs_path).startswith(os.path.realpath(DATA_DIR)):
        return "Invalid path", 400
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return json.dumps({'status': 'success'})


@app.route('/api/file', methods=['DELETE'])
def api_delete_file():
    path = request.args.get('path')
    if not path:
        return "Path parameter missing", 400
    abs_path = os.path.join(DATA_DIR, path)
    if not os.path.realpath(abs_path).startswith(os.path.realpath(DATA_DIR)):
        return "Invalid path", 400
    if os.path.exists(abs_path):
        if os.path.isdir(abs_path):
            shutil.rmtree(abs_path)
        else:
            os.remove(abs_path)
        return json.dumps({'status': 'success'})
    return "File not found", 404


@app.route('/api/file/rename', methods=['POST'])
def api_rename_file():
    data = request.get_json()
    if not data or 'oldPath' not in data or 'newPath' not in data:
        return "Missing data", 400
    old_path = os.path.join(DATA_DIR, data['oldPath'])
    new_path = os.path.join(DATA_DIR, data['newPath'])
    if not (os.path.realpath(old_path).startswith(os.path.realpath(DATA_DIR)) and
            os.path.realpath(new_path).startswith(os.path.realpath(DATA_DIR))):
        return "Invalid path", 400
    if os.path.exists(old_path):
        os.makedirs(os.path.dirname(new_path), exist_ok=True)
        os.rename(old_path, new_path)
        return json.dumps({'status': 'success'})
    return "File not found", 404


@app.route('/api/folder', methods=['POST'])
def api_create_folder():
    data = request.get_json()
    if not data or 'path' not in data:
        return "Missing data", 400
    folder_path = os.path.join(DATA_DIR, data['path'])
    if not os.path.realpath(folder_path).startswith(os.path.realpath(DATA_DIR)):
        return "Invalid path", 400
    os.makedirs(folder_path, exist_ok=True)
    return json.dumps({'status': 'success'})


#############################
#  LaTeX Compilation Helpers
#############################

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
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and getattr(node, 'name',
                                                                                                   None) == selector:
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


################################
#  Socket.IO Event Handlers
################################

@socketio.on('update_text')
def handle_text_update(data):
    file_path = data.get('path')
    if not file_path:
        return  # or emit an error
    abs_path = os.path.join(DATA_DIR, file_path)
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    with open(abs_path, 'w', encoding='utf-8') as f:
        f.write(data.get('content', ''))
    emit('update_text', data, broadcast=True, include_self=False)


@socketio.on('compile_latex')
def compile_latex(data=None):
    ignore_warnings = data.get('ignoreWarnings', False) if data else False
    tex_file = data.get('path')
    if not tex_file or not tex_file.endswith('.tex'):
        emit('compilation_done', {'status': 'error', 'logs': 'No valid .tex file provided.'}, broadcast=True)
        return

    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR)
    os.makedirs(TEMP_DIR, exist_ok=True)
    shutil.copytree(DATA_DIR, TEMP_DIR, dirs_exist_ok=True)
    abs_tex_file = os.path.join(TEMP_DIR, tex_file)
    if not os.path.exists(abs_tex_file):
        emit('compilation_done', {'status': 'error', 'logs': 'Main file not found.'}, broadcast=True)
        return

    with open(abs_tex_file, 'r', encoding='utf-8') as f:
        content = f.read()
    processed_content = process_github_commands(content)
    with open(abs_tex_file, 'w', encoding='utf-8') as f:
        f.write(processed_content)

    workdir = os.path.dirname(abs_tex_file)
    base_name = os.path.splitext(os.path.basename(tex_file))[0]

    bibliography = r"\bibliography" in content

    # First pass of pdflatex
    p1 = subprocess.run(
        ["pdflatex", "-shell-escape", "-interaction=nonstopmode", os.path.basename(tex_file)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=workdir
    )

    if bibliography:

        # Run bibtex
        bib = subprocess.run(
            ["bibtex", base_name],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=workdir
        )

        # Second pass of pdflatex
        p2 = subprocess.run(
            ["pdflatex", "-shell-escape", "-interaction=nonstopmode", os.path.basename(tex_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=workdir
        )

        # Third pass of pdflatex
        p3 = subprocess.run(
            ["pdflatex", "-shell-escape", "-interaction=nonstopmode", os.path.basename(tex_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=workdir
        )

    # Combine logs from all commands
    logs = p1.stdout.decode() + p1.stderr.decode()

    if bibliography:
        logs += (
            bib.stdout.decode() + bib.stderr.decode() +
            p2.stdout.decode() + p2.stderr.decode() +
            p3.stdout.decode() + p3.stderr.decode()
        )

    # Check for errors in any of the steps
    if (p1.returncode or (bibliography and (bib.returncode or p2.returncode or p3.returncode))) != 0 and not ignore_warnings:
        status = "error"
    else:
        status = "success"

    emit('compilation_done', {'status': status, 'logs': logs}, broadcast=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/pdf')
def serve_pdf():
    pdf_file = request.args.get('file', 'document.pdf')
    pdf_path = os.path.join(TEMP_DIR, pdf_file)
    if not os.path.exists(pdf_path):
        return "No PDF available", 404

    with open(pdf_path, "rb") as pdf_file_obj:
        response = Response(pdf_file_obj.read(), mimetype="application/pdf")
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


if __name__ == '__main__':
    socketio.run(app, debug=True)
