import os
import subprocess
import shutil
import requests
from config import Config
from file_manager import read_file, write_file


def compile_latex_file(tex_file, ignore_warnings=False):
    if os.path.exists(Config.TEMP_DIR):
        shutil.rmtree(Config.TEMP_DIR)
    os.makedirs(Config.TEMP_DIR, exist_ok=True)
    shutil.copytree(Config.DATA_DIR, Config.TEMP_DIR, dirs_exist_ok=True)

    abs_tex_file = os.path.join(Config.TEMP_DIR, tex_file)
    print(f"Absolute path of the file: {abs_tex_file}, {Config.DATA_DIR}, {Config.TEMP_DIR}")
    if not os.path.exists(abs_tex_file):
        return {'status': 'error', 'logs': 'Main file not found.'}

    content = read_file(abs_tex_file)
    print(f"Content of the file: {content}")
    processed_content = requests.post("http://ref-service:8001/code_ref", json={"content": content}).json()
    write_file(abs_tex_file, processed_content)

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
