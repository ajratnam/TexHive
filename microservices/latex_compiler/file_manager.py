import os
import shutil
from config import Config


def get_file_tree(directory, uid):
    tree = []
    for entry in os.scandir(directory):
        rel_path = os.path.relpath(entry.path, Config.DATA_DIR / uid)
        if entry.is_dir():
            tree.append({
                'name': entry.name,
                'path': rel_path,
                'isDirectory': True,
                'children': get_file_tree(entry.path, uid)
            })
        else:
            tree.append({
                'name': entry.name,
                'path': rel_path,
                'isDirectory': False
            })
    return tree


def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def delete_path(path):
    if os.path.isdir(path):
        shutil.rmtree(path)
    else:
        os.remove(path)


def rename_path(old_path, new_path):
    os.makedirs(os.path.dirname(new_path), exist_ok=True)
    os.rename(old_path, new_path)
