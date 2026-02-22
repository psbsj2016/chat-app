from fastapi import FastAPI
from pydantic import BaseModel
import requests
import os
import uvicorn

# Configuração da Chave de API da Inteligência Artificial
API_KEY = os.getenv("GEMINI_API_KEY", "COLE_SUA_CHAVE_AQUI")

app = FastAPI()

class MessageRequest(BaseModel):
    message: str

@app.post("/ask")
async def ask_bot(req: MessageRequest):
    try:
        prompt = f"Você é o CPTT Bot, um assistente virtual prestativo, educado e inteligente integrado a um aplicativo de chat premium. Responda de forma clara e amigável à seguinte mensagem:\n\nUsuário: {req.message}"
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        # MÁGICA: Se o Google barrar a requisição, a IA te avisa o porquê!
        if 'error' in data:
            error_msg = data['error'].get('message', 'Erro desconhecido do Google')
            return {"reply": f"🚨 O Google bloqueou minha resposta. Motivo: {error_msg}"}
        
        reply_text = data['candidates'][0]['content']['parts'][0]['text']
        return {"reply": reply_text}
        
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": f"🚨 Erro interno no Python: {str(e)}"}

if __name__ == "__main__":
    print("🤖 Cérebro Python CPTT Bot rodando (Modo REST API Ultra Blindado)...")
    uvicorn.run(app, host="0.0.0.0", port=8000)