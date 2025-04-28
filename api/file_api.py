from flask import Blueprint, request, jsonify
import os
from core.config import Config
from core.utils.file_manager import get_file_tree, read_file, write_file, delete_path, rename_path
from routes.main import login_required, project_required

bp = Blueprint('file_api', __name__)


@bp.route('/files', methods=['GET'])
@login_required
@project_required(False)
def api_files(uid, project):
    if project:
        tree = get_file_tree(Config.DATA_DIR / uid / project, uid, project)
    else:
        tree = get_file_tree(Config.DATA_DIR / uid, uid)
    return jsonify(tree)


@bp.route('/file', methods=['GET'])
@login_required
@project_required
def api_get_file(uid, project):
    path = request.args.get('path')
    if not path:
        return "Path parameter missing", 400
    abs_path = os.path.join(Config.DATA_DIR / uid / project, path)
    if not os.path.realpath(abs_path).startswith(os.path.realpath(Config.DATA_DIR / uid / project)):
        return "Invalid path", 400
    if not os.path.exists(abs_path) or not os.path.isfile(abs_path):
        return "File not found", 404
    content = read_file(abs_path)
    return jsonify({'path': path, 'content': content})


@bp.route('/file', methods=['POST'])
@login_required
@project_required
def api_post_file(uid, project):
    data = request.get_json()
    if not data or 'path' not in data or 'content' not in data:
        return "Missing data", 400
    path = data['path']
    content = data['content']
    abs_path = os.path.join(Config.DATA_DIR / uid / project, path)
    if not os.path.realpath(abs_path).startswith(os.path.realpath(Config.DATA_DIR / uid / project)):
        return "Invalid path", 400
    write_file(abs_path, content)
    return jsonify({'status': 'success'})


@bp.route('/file', methods=['DELETE'])
@login_required
@project_required
def api_delete_file(uid, project):
    path = request.args.get('path')
    if not path:
        return "Path parameter missing", 400
    abs_path = os.path.join(Config.DATA_DIR / uid / project, path)
    if not os.path.realpath(abs_path).startswith(os.path.realpath(Config.DATA_DIR / uid / project)):
        return "Invalid path", 400
    if os.path.exists(abs_path):
        delete_path(abs_path)
        return jsonify({'status': 'success'})
    return "File not found", 404


@bp.route('/file/rename', methods=['POST'])
@login_required
@project_required
def api_rename_file(uid, project):
    data = request.get_json()
    if not data or 'oldPath' not in data or 'newPath' not in data:
        return "Missing data", 400
    old_path = os.path.join(Config.DATA_DIR / uid / project, data['oldPath'])
    new_path = os.path.join(Config.DATA_DIR / uid / project, data['newPath'])
    if not (os.path.realpath(old_path).startswith(os.path.realpath(Config.DATA_DIR / uid / project)) and
            os.path.realpath(new_path).startswith(os.path.realpath(Config.DATA_DIR / uid / project))):
        return "Invalid path", 400
    if os.path.exists(old_path):
        rename_path(old_path, new_path)
        return jsonify({'status': 'success'})
    return "File not found", 404


@bp.route('/folder', methods=['POST'])
@login_required
@project_required(False)
def api_create_folder(uid, project):
    data = request.get_json()
    if not data or 'path' not in data:
        return "Missing data", 400
    folder_path = os.path.join(Config.DATA_DIR / uid / project, data['path'])
    if not os.path.realpath(folder_path).startswith(os.path.realpath(Config.DATA_DIR / uid / project)):
        return "Invalid path", 400
    os.makedirs(folder_path, exist_ok=True)
    return jsonify({'status': 'success'})
