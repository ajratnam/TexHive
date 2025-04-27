import os
import subprocess
import shutil
import requests
import re
from config import Config
from file_manager import read_file, write_file


def compile_latex_file(tex_file, ignore_warnings=False):
    if os.path.exists(Config.TEMP_DIR):
        for filename in os.listdir(Config.TEMP_DIR):
            file_path = os.path.join(Config.TEMP_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
    os.makedirs(Config.TEMP_DIR, exist_ok=True)
    shutil.copytree(Config.DATA_DIR, Config.TEMP_DIR, dirs_exist_ok=True)

    abs_tex_file = os.path.join(Config.TEMP_DIR, tex_file)
    if not os.path.exists(abs_tex_file):
        return {'status': 'error', 'logs': 'Main file not found.'}

    content = read_file(abs_tex_file)
    pattern = r'\\Github\{([^}]*)\}'

    if re.search(pattern, content):
        try:
            processed_content = requests.post("http://ref-service:8001/code_ref", json={"content": content}).json()
            write_file(abs_tex_file, processed_content)
        except Exception as e:
            return {'status': 'error', 'logs': f'Error processing GitHub commands: {str(e)}'}
        
    workdir = os.path.dirname(abs_tex_file)
    base_name = os.path.splitext(os.path.basename(tex_file))[0]
    bibliography = r"\bibliography" in content

    logs = ""

    p1 = subprocess.run(
        ["pdflatex", "-shell-escape", "-interaction=nonstopmode", "-synctex=1", os.path.basename(tex_file)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        cwd=workdir
    )
    logs += p1.stdout.decode() + p1.stderr.decode()

    if bibliography:
        bib = subprocess.run(
            ["bibtex", base_name],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=workdir
        )
        logs += bib.stdout.decode() + bib.stderr.decode()

        p2 = subprocess.run(
            ["pdflatex", "-shell-escape", "-interaction=nonstopmode", "-synctex=1", os.path.basename(tex_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=workdir
        )
        logs += p2.stdout.decode() + p2.stderr.decode()

        p3 = subprocess.run(
            ["pdflatex", "-shell-escape", "-interaction=nonstopmode", "-synctex=1", os.path.basename(tex_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=workdir
        )
        logs += p3.stdout.decode() + p3.stderr.decode()

    if (p1.returncode or (
            bibliography and (bib.returncode or p2.returncode or p3.returncode))) != 0 and not ignore_warnings:
        status = "error"
    else:
        status = "success"

    return {'status': status, 'logs': logs}
