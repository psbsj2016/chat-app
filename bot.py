from fastapi import FastAPI
from pydantic import BaseModel
import requests
import os
import uvicorn
import json

# Configuração da Chave de API da Inteligência Artificial
API_KEY = os.getenv("GEMINI_API_KEY", "COLE_SUA_CHAVE_AQUI")

app = FastAPI()

class MessageRequest(BaseModel):
    message: str

@app.post("/ask")
async def ask_bot(req: MessageRequest):
    try:
        prompt = f"Você é o CPTT Bot, um assistente virtual prestativo, educado e inteligente integrado a um aplicativo de chat premium. Responda de forma clara e amigável à seguinte mensagem:\n\nUsuário: {req.message}"
        
        # A cartada final: Usando a versão v1 estável e o modelo Universal "gemini-pro"
        url = f"https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key={API_KEY}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if 'error' in data:
            error_msg = data['error'].get('message', 'Erro desconhecido do Google')
            return {"reply": f"🚨 O Google bloqueou a resposta. Motivo: {error_msg}"}
            
        if 'candidates' not in data:
            debug_info = json.dumps(data, indent=2, ensure_ascii=False)
            return {"reply": f"🚨 O Google mandou uma resposta misteriosa:\n{debug_info}"}
        
        # Sucesso absoluto!
        reply_text = data['candidates'][0]['content']['parts'][0]['text']
        return {"reply": reply_text}
        
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": f"🚨 Erro interno no Python: {str(e)}"}

if __name__ == "__main__":
    print("🤖 Cérebro Python CPTT Bot rodando (Modo Universal)...")
    uvicorn.run(app, host="0.0.0.0", port=8000)