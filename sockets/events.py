import os
from core.config import Config
from core.utils.file_manager import write_file
import requests
from flask_socketio import emit, join_room, leave_room


def register_socket_events(socketio, app):
    @socketio.on('update_text')
    def handle_text_update(data):
        file_path = data.get('path')
        if not file_path:
            return  # Optionally emit an error
        uid = data.get('uid') if data else None
        project = data.get('project') if data else None
        
        if not all([file_path, uid, project]):
            return
            
        # Save the file
        abs_path = os.path.join(Config.DATA_DIR / uid / project, file_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        write_file(abs_path, data.get('content', ''))
        
        # Broadcast to all users in the project room
        room = f"project_{project}"
        emit('text_updated', {
            'path': file_path,
            'content': data.get('content', ''),
            'uid': uid
        }, room=room, include_self=False)  # Don't send back to sender

    @socketio.on('collaborator_removed')
    def handle_collaborator_removed(data):
        project_name = data.get('projectName')
        if project_name:
            # Broadcast to all clients in the project room
            room = f"project_{project_name}"
            emit('collaborator_removed', {
                'collaboratorUid': data.get('collaboratorUid'),
                'projectName': project_name,
                'shareHash': data.get('shareHash')
            }, room=room, broadcast=True)
        else:
            # Fallback to broadcasting to all clients if no project name
            emit('collaborator_removed', {
                'collaboratorUid': data.get('collaboratorUid'),
                'shareHash': data.get('shareHash')
            }, broadcast=True)

    @socketio.on('update_access_level')
    def handle_access_level_update(data):
        project_name = data.get('projectName')
        collaborator_uid = data.get('collaboratorUid')
        new_access_level = data.get('newAccessLevel')
        
        if not all([project_name, collaborator_uid, new_access_level]):
            return
            
        # Broadcast to all clients in the project room
        room = f"project_{project_name}"
        emit('access_level_changed', {
            'collaboratorUid': collaborator_uid,
            'newAccessLevel': new_access_level,
            'projectName': project_name
        }, room=room, broadcast=True)
        
        # Also broadcast to all rooms to ensure the user gets the update even if not in the project room
        emit('access_level_changed', {
            'collaboratorUid': collaborator_uid,
            'newAccessLevel': new_access_level,
            'projectName': project_name
        }, broadcast=True)

    @socketio.on('join_project')
    def on_join_project(data):
        project_name = data.get('projectName')
        if project_name:
            room = f"project_{project_name}"
            join_room(room)

    @socketio.on('leave_project')
    def on_leave_project(data):
        project_name = data.get('projectName')
        if project_name:
            room = f"project_{project_name}"
            leave_room(room)

    @socketio.on('compile_latex')
    def handle_compile_latex(data=None):
        ignore_warnings = data.get('ignoreWarnings', False) if data else False
        tex_file = data.get('path') if data else None
        uid = data.get('uid') if data else None
        project = data.get('project') if data else None
        if not tex_file or not tex_file.endswith('.tex'):
            emit('compilation_done', {'status': 'error', 'logs': 'No valid .tex file provided.'}, broadcast=True)
            return

        result = requests.post("http://compile-service:8002/compile", json={"tex_file":  tex_file, "ignore_warnings": ignore_warnings, 'uid': uid, 'project': project}).json()
        emit('compilation_done', result, broadcast=True)
