from core import create_app
from core.extensions import socketio
from flask import send_from_directory
import os

app = create_app()

@app.route('/<path:path>', methods=['GET'])
def serve_react_app(path):
    if path and os.path.exists(os.path.join('frontend/build', path)):
        return send_from_directory('frontend/build', path)
    else:
        return send_from_directory('frontend/build', 'index.html')

if __name__ == '__main__':
    socketio.run(app, debug=True, host="0.0.0.0", port=8000)
