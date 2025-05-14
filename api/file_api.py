from flask import Blueprint, request, jsonify
import os
import shutil
from core.config import Config
from core.utils.file_manager import get_file_tree, read_file, write_file, delete_path, rename_path
from routes.main import login_required, project_required, get_shared_data, save_shared_data

bp = Blueprint('file_api', __name__)


@bp.route('/files', methods=['GET'])
@login_required
@project_required(False)
def api_files(uid, project):
    try:
        if project:
            tree = get_file_tree(Config.DATA_DIR / uid / project, uid, project)
        else:
            # For root level, we want to show only the project folders
            projects = []
            user_dir = Config.DATA_DIR / uid
            if os.path.exists(user_dir):
                for entry in os.scandir(user_dir):
                    if entry.is_dir():
                        projects.append({
                            'name': entry.name,
                            'path': entry.name,
                            'isDirectory': True
                        })
            return jsonify(projects)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
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
@project_required(False)
def api_delete_file(uid, project):
    path = request.args.get('path')
    if not path:
        return jsonify({'error': "Path parameter missing"}), 400
    
    try:
        # For project deletion (when project is None), path is relative to user directory
        # For file deletion (when project is set), path is relative to project directory
        if project:
            base_dir = Config.DATA_DIR / uid / project
            abs_path = os.path.join(base_dir, path)
            real_base_dir = os.path.realpath(base_dir)
        else:
            base_dir = Config.DATA_DIR / uid
            abs_path = os.path.join(base_dir, path)
            real_base_dir = os.path.realpath(base_dir)
        
        # Convert target path to real path
        real_abs_path = os.path.realpath(abs_path)
        
        # Security check - ensure path is within the appropriate directory
        if not real_abs_path.startswith(real_base_dir):
            return jsonify({'error': "Invalid path - access denied"}), 400
        
        # If it's a symlink, we need to delete both the link and the shared directory
        if os.path.islink(abs_path):
            # Get the target of the symlink (shared directory)
            shared_dir = os.path.realpath(abs_path)
            # Delete the symlink first
            os.unlink(abs_path)
            # Delete the shared directory if it exists
            if os.path.exists(shared_dir):
                shutil.rmtree(shared_dir)
            # Also remove the project from shared data.json
            shared_dir_name = os.path.basename(shared_dir)
            shared_data = get_shared_data()
            if shared_dir_name in shared_data:
                del shared_data[shared_dir_name]
                save_shared_data(shared_data)
        else:
            # For regular files/directories
            if os.path.exists(abs_path):
                if os.path.isdir(abs_path):
                    shutil.rmtree(abs_path)
                else:
                    os.remove(abs_path)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/file/rename', methods=['POST'])
@login_required
@project_required(False)
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
