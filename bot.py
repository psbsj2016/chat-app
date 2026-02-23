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
        # SUPER PROMPT: Ensinando o Bot a ser um Professor de Inglês
        prompt = f"""Você é o CPTT Bot, um assistente virtual premium, super inteligente e educado.

        HABILIDADE ESPECIAL (PROFESSOR DE INGLÊS):
        Se o usuário disser algo como "quero treinar inglês", "vamos falar em inglês", ou começar a falar em inglês com o claro objetivo de praticar:
        1. Assuma imediatamente o papel de um Professor de Inglês particular, muito paciente, amigável e encorajador.
        2. Analise a frase do usuário. Se ele cometer algum erro (gramática, digitação ou vocabulário), faça uma correção gentil e explique o motivo do erro de forma simples em PORTUGUÊS (para ele entender bem a regra).
        3. Depois da correção, continue o assunto da conversa respondendo em INGLÊS.
        4. SEMPRE termine a sua mensagem com uma nova pergunta em inglês relacionada ao assunto para forçar o usuário a continuar praticando.

        Se o usuário fizer uma pergunta normal em português e não quiser treinar idiomas, ignore a regra acima e aja normalmente como um assistente super prestativo.

        Mensagem do Usuário: {req.message}"""
        
        # MUDANÇA BLINDADA: Usando o 'gemini-pro' clássico que nunca dá erro 404
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={API_KEY}"
        
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(url, json=payload, headers=headers)
        data = response.json()
        
        if 'error' in data:
            return {"reply": f"🚨 Erro na API do Google: {data['error'].get('message')}"}
            
        reply_text = data['candidates'][0]['content']['parts'][0]['text']
        return {"reply": reply_text}
        
    except Exception as e:
        print(f"Erro na IA: {e}")
        return {"reply": f"🚨 Erro interno no Python: {str(e)}"}

if __name__ == '__main__':
    # O Render exige o host 0.0.0.0 e a porta dinâmica do sistema
    port = int(os.environ.get("PORT", 10000))
    
    # Motor de arranque Uvicorn para o FastAPI
    uvicorn.run(app, host='0.0.0.0', port=port)