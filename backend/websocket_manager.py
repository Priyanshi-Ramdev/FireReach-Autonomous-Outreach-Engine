from fastapi import WebSocket
from typing import Dict

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, job_id: str):
        await websocket.accept()
        self.active_connections[job_id] = websocket

    def disconnect(self, job_id: str):
        if job_id in self.active_connections:
            del self.active_connections[job_id]

    async def send_updates(self, job_id: str, updates: dict):
        if job_id in self.active_connections:
            try:
                await self.active_connections[job_id].send_json(updates)
            except Exception:
                self.disconnect(job_id)

manager = ConnectionManager()
