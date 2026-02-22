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
        # 1. O cérebro do Bot
        prompt = f"Você é o CPTT Bot, um assistente virtual prestativo, educado e inteligente integrado a um aplicativo de chat premium. Responda de forma clara e amigável à seguinte mensagem:\n\nUsuário: {req.message}"
        
        # 2. Comunicação DIRETA com os servidores do Google (sem bibliotecas com bug)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        headers = {"Content-Type": "application/json"}
        
        # 3. Dispara a mensagem e pega a resposta
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        # 4. Extrai o texto da resposta
        reply_text = data['candidates'][0]['content']['parts'][0]['text']
        
        return {"reply": reply_text}
        
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": "Desculpe, meu cérebro de IA está passando por uma atualização no momento. Tente novamente em alguns segundos! 🤖"}

if __name__ == "__main__":
    print("🤖 Cérebro Python CPTT Bot rodando (Modo REST API Blindado)...")
    uvicorn.run(app, host="0.0.0.0", port=8000)