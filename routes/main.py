import os
from urllib.parse import urlparse, parse_qs
import secrets
import shutil
import json
from datetime import datetime

from flask import Blueprint, render_template, Response, request, redirect, url_for, jsonify
from core.config import Config
import firebase_admin
from firebase_admin import credentials, auth
from functools import wraps

bp = Blueprint('main', __name__)
   
cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'credentials.json'))
firebase_admin.initialize_app(cred)

def get_shared_data():
    data_file = Config.DATA_DIR / 'shared' / 'data.json'
    if not os.path.exists(data_file):
        os.makedirs(data_file.parent, exist_ok=True)
        with open(data_file, 'w') as f:
            json.dump({}, f)
    with open(data_file, 'r') as f:
        return json.load(f)

def save_shared_data(data):
    data_file = Config.DATA_DIR / 'shared' / 'data.json'
    with open(data_file, 'w') as f:
        json.dump(data, f, indent=2, default=str)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.cookies.get('token')
        if not token:
            return redirect(url_for('main.login'))
        try:
            uid = auth.verify_id_token(token)['uid']
        except:
            return redirect(url_for('main.login'))
        return f(*args, **kwargs, uid=uid)
    return decorated_function


def project_required(required=True):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            referrer = request.referrer
            if referrer:
                query = urlparse(referrer).query
                params = parse_qs(query)
                project = params.get('project', [""])[0]
            else:
                project = ""

            if required and not project:
                return redirect(url_for("main.index"))

            return f(*args, **kwargs, project=project)

        return decorated_function

    if callable(required):
        f = required
        required = True
        return decorator(f)

    return decorator


@bp.route('/')
@login_required
def index(uid):
    (Config.DATA_DIR / uid).mkdir(exist_ok=True)
    return render_template('projects.html')


@bp.route('/editor')
@login_required
def editor(uid):
    (Config.DATA_DIR / uid).mkdir(exist_ok=True)
    project_name = request.args.get('project')
    if not project_name:
        return "Project name is required", 400
    project_dir = Config.DATA_DIR / uid / project_name
    if not os.path.exists(project_dir):
        return "Project does not exist", 404
    return render_template('editor.html')


@bp.route('/pdf')
@login_required
@project_required
def serve_pdf(uid, project):
    pdf_file = request.args.get('file', 'document.pdf')
    pdf_path = os.path.join(Config.TEMP_DIR / uid / project, pdf_file)
    if not os.path.exists(pdf_path):
        return "No PDF available", 404

    with open(pdf_path, "rb") as pdf_file_obj:
        response = Response(pdf_file_obj.read(), mimetype="application/pdf")
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


@bp.route('/verify-token', methods=['POST'])
def verify_token():
    token = request.json.get('token')
    try:
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        return {"status": "success", "uid": uid}, 200
    except Exception as e:
        return {"status": "error", "message": str(e)}, 401


@bp.route('/login')
def login():
    return render_template('login.html')


@bp.route('/is-authenticated')
def is_authenticated():
    token = request.args.get('token')
    if not token:
        return jsonify({"authenticated": False}), 401
    try:
        auth.verify_id_token(token)
        return jsonify({"authenticated": True}), 200
    except:
        return jsonify({"authenticated": False}), 401


@bp.route('/logout')
def logout():
    response = redirect(url_for('main.login'))
    try:
        token = request.cookies.get('token')
        if token:
            # Revoke the refresh tokens for the user
            decoded_token = auth.verify_id_token(token)
            uid = decoded_token['uid']
            auth.revoke_refresh_tokens(uid)
            print(f"Refresh tokens revoked for user: {uid}")
        # Clear the token cookie
        response.delete_cookie('token')
    except Exception as e:
        print(f"Error revoking token: {e}")
    return response


@bp.route('/api/share-project', methods=['POST'])
@login_required
def share_project(uid):
    data = request.get_json()
    project_name = data.get('projectName')
    project_path = data.get('projectPath')
    
    if not project_name or not project_path:
        return jsonify({'error': 'Missing project information'}), 400
    
    source_dir = Config.DATA_DIR / uid / project_name
    
    # Check if project is already shared by checking if it's a symlink
    if os.path.islink(source_dir):
        # Get the target of the symlink
        target = os.path.realpath(source_dir)
        # Extract hash from the target path (last directory name)
        existing_hash = os.path.basename(target)
        # Verify this is a valid shared project
        shared_data = get_shared_data()
        if existing_hash in shared_data:
            return jsonify({'shareHash': existing_hash})
    
    # If not already shared, proceed with sharing process
    share_hash = secrets.token_urlsafe(16)
    
    # Get user information
    try:
        user = auth.get_user(uid)
    except:
        return jsonify({'error': 'Failed to get user information'}), 500
    
    # Add project information to data.json
    shared_data = get_shared_data()
    shared_data[share_hash] = {
        'name': project_name,
        'owner': {
            'uid': uid,
            'name': user.display_name,
            'email': user.email
        },
        'collaborators': [],
        'created': datetime.now(),
        'collaboration_url_hash': share_hash
    }
    
    # Move project files to shared directory
    shared_dir = Config.DATA_DIR / 'shared' / share_hash
    
    try:
        # Create shared directory if it doesn't exist
        os.makedirs(shared_dir.parent, exist_ok=True)
        # Copy project files to shared directory
        shutil.copytree(source_dir, shared_dir)
        # Remove the original directory after successful copy
        shutil.rmtree(source_dir)
        # Create a symbolic link from the original location to the shared directory
        os.symlink(shared_dir, source_dir, target_is_directory=True)
        # Save the updated shared data
        save_shared_data(shared_data)
    except Exception as e:
        # Clean up if anything fails
        if os.path.exists(shared_dir):
            shutil.rmtree(shared_dir)
        if os.path.exists(source_dir) and os.path.islink(source_dir):
            os.unlink(source_dir)
        return jsonify({'error': f'Failed to share project: {str(e)}'}), 500
    
    return jsonify({'shareHash': share_hash})


@bp.route('/join-project/<share_hash>')
@login_required
def join_project(uid, share_hash):
    # Get project information from data.json
    shared_data = get_shared_data()
    project_data = shared_data.get(share_hash)
    
    if not project_data:
        return "Project not found", 404
        
    # Check if user is already a collaborator
    existing_collab = next((c for c in project_data['collaborators'] if c['uid'] == uid), None)
    if not existing_collab:
        try:
            user = auth.get_user(uid)
            # Add user as viewer by default
            project_data['collaborators'].append({
                'uid': uid,
                'name': user.display_name,
                'email': user.email,
                'access_level': 'viewer'  # Default access level
            })
            save_shared_data(shared_data)
        except Exception as e:
            return f"Failed to join project: {str(e)}", 500
    
    # Create symbolic link to shared project in user's directory
    user_dir = Config.DATA_DIR / uid
    project_link = user_dir / project_data['name']
    shared_dir = Config.DATA_DIR / 'shared' / share_hash
    
    try:
        os.makedirs(user_dir, exist_ok=True)
        if os.path.exists(project_link):
            if os.path.islink(project_link):
                os.unlink(project_link)
            else:
                return "Project with same name already exists", 400
        os.symlink(shared_dir, project_link, target_is_directory=True)
    except Exception as e:
        return f"Failed to setup project: {str(e)}", 500
    
    return redirect(url_for('main.editor', project=project_data['name']))


@bp.route('/api/project/collaborators', methods=['GET'])
@login_required
def get_collaborators(uid):
    share_hash = request.args.get('hash')
    if not share_hash:
        return jsonify({'error': 'Missing project hash'}), 400
        
    data_file = Config.DATA_DIR / 'shared' / 'data.json'
    if not os.path.exists(data_file):
        os.makedirs(data_file.parent, exist_ok=True)
        with open(data_file, 'w') as f:
            json.dump({}, f)
            
    with open(data_file, 'r') as f:
        shared_data = json.load(f)
        
    project_data = shared_data.get(share_hash, {})
    
    if not project_data:
        return jsonify({'error': 'Project not found'}), 404
        
    # Ensure collaborators have access_level
    for collab in project_data.get('collaborators', []):
        if 'access_level' not in collab:
            collab['access_level'] = 'viewer'
            
    return jsonify({
        'collaborators': project_data.get('collaborators', []),
        'owner': project_data.get('owner', {})
    })

@bp.route('/api/project/collaborator', methods=['PUT', 'DELETE'])
@login_required
def update_collaborator_access(uid):
    data = request.get_json()
    share_hash = data.get('hash')
    collaborator_uid = data.get('collaboratorUid')
    
    if request.method == 'DELETE':
        if not all([share_hash, collaborator_uid]):
            return jsonify({'error': 'Invalid request data'}), 400
            
        shared_data = get_shared_data()
        project_data = shared_data.get(share_hash)
        
        if not project_data:
            return jsonify({'error': 'Project not found'}), 404
            
        # Only owner can remove collaborators
        if project_data['owner']['uid'] != uid:
            return jsonify({'error': 'Unauthorized'}), 403
            
        # Remove collaborator from data.json
        project_data['collaborators'] = [c for c in project_data['collaborators'] if c['uid'] != collaborator_uid]
        save_shared_data(shared_data)

        # Remove symbolic link from collaborator's directory
        try:
            collaborator_dir = Config.DATA_DIR / collaborator_uid
            project_link = collaborator_dir / project_data['name']
            if os.path.islink(project_link):
                os.unlink(project_link)
        except Exception as e:
            print(f"Error removing symbolic link: {str(e)}")
            # Don't return error since we've already updated the data.json
            
        return jsonify({'status': 'success'})
    
    elif request.method == 'PUT':
        access_level = data.get('accessLevel')
        if not all([share_hash, collaborator_uid, access_level]) or access_level not in ['viewer', 'editor']:
            return jsonify({'error': 'Invalid request data'}), 400
            
        shared_data = get_shared_data()
        project_data = shared_data.get(share_hash)
        
        if not project_data:
            return jsonify({'error': 'Project not found'}), 404
            
        # Only owner can modify collaborator access
        if project_data['owner']['uid'] != uid:
            return jsonify({'error': 'Unauthorized'}), 403
            
        # Update collaborator access level
        for collab in project_data['collaborators']:
            if collab['uid'] == collaborator_uid:
                collab['access_level'] = access_level
                save_shared_data(shared_data)
                return jsonify({'status': 'success'})
                
        return jsonify({'error': 'Collaborator not found'}), 404
