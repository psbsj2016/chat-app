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
        # 1. PERGUNTA AO GOOGLE: "Quais modelos eu tenho permissão para usar?"
        url_list = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
        res_list = requests.get(url_list)
        data_list = res_list.json()

        if 'error' in data_list:
            return {"reply": f"🚨 Erro na sua Chave API: {data_list['error'].get('message')}"}

        # 2. FILTRA: Pega apenas os nomes dos modelos que servem para gerar texto
        modelos_permitidos = [m['name'] for m in data_list.get('models', []) if 'generateContent' in m.get('supportedGenerationMethods', [])]

        if not modelos_permitidos:
            return {"reply": "🚨 A sua chave é válida, mas o Google não liberou nenhum modelo de texto para ela!"}

        # 3. ESCOLHE: Tenta pegar o 1.5, se não achar pega qualquer Gemini liberado
        modelo_escolhido = None
        for m in modelos_permitidos:
            if 'gemini-1.5-flash' in m:
                modelo_escolhido = m
                break
                
        if not modelo_escolhido:
            for m in modelos_permitidos:
                if 'gemini' in m:
                    modelo_escolhido = m
                    break
                    
        if not modelo_escolhido:
            modelo_escolhido = modelos_permitidos[0] # Pega o que tiver!

        # 4. CHAT: Agora faz a chamada usando o modelo exato que o Google mandou usar
        prompt = f"Você é o CPTT Bot, um assistente virtual prestativo, educado e inteligente integrado a um aplicativo de chat premium. Responda de forma clara e amigável à seguinte mensagem:\n\nUsuário: {req.message}"
        
        # O modelo escolhido já vem com a palavra "models/" na frente
        url_chat = f"https://generativelanguage.googleapis.com/v1beta/{modelo_escolhido}:generateContent?key={API_KEY}"
        
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(url_chat, json=payload, headers=headers)
        data = response.json()
        
        if 'error' in data:
            return {"reply": f"🚨 O Google bloqueou no modelo {modelo_escolhido}. Motivo: {data['error'].get('message')}"}
            
        reply_text = data['candidates'][0]['content']['parts'][0]['text']
        
        # Vou colocar o nome do modelo no final só para sabermos qual ele usou!
        return {"reply": f"{reply_text}"}
        
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": f"🚨 Erro interno no Python: {str(e)}"}

if __name__ == "__main__":
    print("🤖 Cérebro Python CPTT Bot rodando (Modo Auto-Descobrimento Hacker)...")
    uvicorn.run(app, host="0.0.0.0", port=8000)