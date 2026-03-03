const { UserEnglish, CatalogoNode, MicroMastery, AttemptLog } = require('./english.models');

class EnglishService {
    
    // Processa uma tentativa, calcula Micro Domínio e verifica avanço linear
    static async processAttempt(userId, nodeId, exerciseId, score, timeMs) {
        // 1. Salva o log bruto (Auditoria)
        await new AttemptLog({ userId, nodeId, exerciseId, score, timeMs }).save();

        // 2. Busca o Nó no Catálogo para saber a trilha (track) e categoria (core/free)
        const nodeInfo = await CatalogoNode.findOne({ nodeId });
        if (!nodeInfo) throw new Error("Nó não encontrado no catálogo.");

        // 3. Busca ou cria o MicroMastery do usuário para este Nó
        let micro = await MicroMastery.findOne({ userId, nodeId });
        if (!micro) {
            micro = new MicroMastery({ userId, nodeId, track: nodeInfo.track, category: nodeInfo.category, isUnlocked: true });
        }

        // 4. FÓRMULA DE RECALCULO DE PRECISÃO E VELOCIDADE
        // Peso maior na tentativa atual (60% atual, 40% histórico)
        micro.precisionScore = micro.precisionScore === 0 ? score : (micro.precisionScore * 0.4) + (score * 0.6);
        
        // Avalia velocidade (Alvo: responder em menos de 3000ms = 100%)
        let currentSpeed = timeMs <= 3000 ? 100 : Math.max(0, 100 - ((timeMs - 3000) / 100));
        micro.speedScore = micro.speedScore === 0 ? currentSpeed : (micro.speedScore * 0.4) + (currentSpeed * 0.6);

        // 5. CÁLCULO DO MICRO DOMÍNIO POR ÁREA
        if (micro.track === 'som') {
            micro.masteryScore = micro.precisionScore; // Som foca na articulação (Áudio)
        } else if (micro.track === 'logica') {
            micro.masteryScore = (micro.precisionScore * 0.5) + (micro.speedScore * 0.5); // Lógica exige raciocínio rápido
        } else { // contexto
            micro.masteryScore = (micro.precisionScore * 0.6) + (micro.speedScore * 0.4); // Contexto exige recall
        }
        micro.masteryScore = Math.min(100, Math.round(micro.masteryScore));
        micro.lastPracticed = new Date();

        // 6. LÓGICA DE PROGRESSÃO LINEAR (Apenas avança o status, não trava pelo Domínio)
        if (!micro.isCompleted) {
            micro.mandatoryCompletedCount += 1;
            if (micro.mandatoryCompletedCount >= 5) {
                micro.isCompleted = true;
                await this.unlockNextNodes(userId, nodeInfo);
            }
        }
        await micro.save();

        // 7. Recalcula os Macros e retorna
        const newMacros = await this.recalculateMacroDomains(userId);
        return { microMastery: micro.masteryScore, isCompleted: micro.isCompleted, macros: newMacros };
    }

    // Algoritmo de Desbloqueio
    static async unlockNextNodes(userId, currentNode) {
        if (currentNode.category === 'core') {
            // Desbloqueia o próximo Core na linha
            const nextCore = await CatalogoNode.findOne({ track: currentNode.track, category: 'core', order: currentNode.order + 1 });
            if (nextCore) {
                await MicroMastery.findOneAndUpdate(
                    { userId, nodeId: nextCore.nodeId },
                    { track: nextCore.track, category: 'core', isUnlocked: true },
                    { upsert: true }
                );
            } else {
                // Se não há mais Core, desbloqueia TODOS os Free Themes daquela trilha (A Nuvem de Temas Livres)
                const freeNodes = await CatalogoNode.find({ track: currentNode.track, category: 'free' });
                for (let free of freeNodes) {
                    await MicroMastery.findOneAndUpdate(
                        { userId, nodeId: free.nodeId },
                        { track: free.track, category: 'free', isUnlocked: true },
                        { upsert: true }
                    );
                }
            }
        }
    }

    // Fórmula do Modelo Híbrido (Core vs Free)
    static async recalculateMacroDomains(userId) {
        const allMicros = await MicroMastery.find({ userId, isUnlocked: true });
        
        let macros = { som: 0, logica: 0, contexto: 0 };
        
        ['som', 'logica', 'contexto'].forEach(track => {
            const trackMicros = allMicros.filter(m => m.track === track);
            const coreMicros = trackMicros.filter(m => m.category === 'core');
            const freeMicros = trackMicros.filter(m => m.category === 'free' && m.masteryScore > 0); // Só conta os free que ele iniciou

            const avgCore = coreMicros.length > 0 ? coreMicros.reduce((acc, m) => acc + m.masteryScore, 0) / coreMicros.length : 0;
            const avgFree = freeMicros.length > 0 ? freeMicros.reduce((acc, m) => acc + m.masteryScore, 0) / freeMicros.length : 0;

            // Se o aluno já iniciou temas livres, pesa Core (80%) e Free (20%). Se não, Core vale 100%.
            if (freeMicros.length > 0) {
                macros[track] = Math.round((avgCore * 0.8) + (avgFree * 0.2));
            } else {
                macros[track] = Math.round(avgCore);
            }
        });

        // Fluência Global = Som(35%) + Lógica(35%) + Contexto(30%)
        const globalFluency = Math.round((macros.som * 0.35) + (macros.logica * 0.35) + (macros.contexto * 0.30));

        await UserEnglish.findOneAndUpdate(
            { userId },
            { macroSom: macros.som, macroLogica: macros.logica, macroContexto: macros.contexto, globalFluency },
            { upsert: true }
        );

        return { ...macros, globalFluency };
    }

// ==========================================
    // ⚡ GERADOR DO TREINO DIÁRIO (TRIATHLON)
    // ==========================================
    static async generateDailyWorkout(userId) {
        // 1. Puxa todos os nós que o aluno já destrancou
        const micros = await MicroMastery.find({ userId, isUnlocked: true });
        if (micros.length === 0) return []; // Se for novo, retorna vazio (o frontend usa o mock)

        // 2. Separa os nós nas 3 categorias táticas
        // UTI: Menores notas primeiro
        const utiPool = [...micros].sort((a, b) => a.masteryScore - b.masteryScore);
        
        // Fronteira: Nós ainda não concluídos (100%), ordenados pelos praticados mais recentemente
        const frontierPool = [...micros].filter(m => !m.isCompleted).sort((a, b) => b.lastPracticed - a.lastPracticed);
        
        // Revisão: Notas altas (>80%), mas que não são treinadas há muito tempo (lastPracticed mais antigo)
        const reviewPool = [...micros].filter(m => m.masteryScore >= 80).sort((a, b) => a.lastPracticed - b.lastPracticed);

        let selectedNodes = [];

        // 3. A Matemática 50-30-20 (5 UTI, 3 Fronteira, 2 Revisão)
        selectedNodes.push(...utiPool.slice(0, 5));
        
        // Se não tiver 3 de fronteira, preenche com mais da UTI
        selectedNodes.push(...(frontierPool.length >= 3 ? frontierPool.slice(0, 3) : utiPool.slice(5, 8))); 
        
        // Se não tiver 2 de revisão, preenche com o que sobrar
        selectedNodes.push(...(reviewPool.length >= 2 ? reviewPool.slice(0, 2) : utiPool.slice(8, 10)));

        // Garante que não passa de 10 exercícios totais
        selectedNodes = selectedNodes.slice(0, 10);
        
        // Baralha os nós (Shuffle) para o treino ser imprevisível
        selectedNodes.sort(() => Math.random() - 0.5);

        // 4. Monta o pacote de exercícios indo buscar ao Catálogo Estático
        const workoutQueue = [];
        for (let micro of selectedNodes) {
            const node = await CatalogoNode.findOne({ nodeId: micro.nodeId });
            // Se o nó existir no BD e tiver exercícios cadastrados
            if (node && node.exercises && node.exercises.length > 0) {
                // Pega 1 exercício aleatório desse nó específico
                const randomEx = node.exercises[Math.floor(Math.random() * node.exercises.length)];
                workoutQueue.push({
                    ...randomEx,
                    nodeId: node.nodeId // INJEÇÃO CRÍTICA: Diz ao frontend de onde veio este exercício!
                });
            }
        }

        return workoutQueue;
    }

// ==========================================
    // 🌱 INJETOR DE CURRÍCULO (DATABASE SEEDER)
    // ==========================================
    static async seedEnglishCatalog() {
        const count = await CatalogoNode.countDocuments();
        if (count > 0) {
            console.log("✅ Catálogo de Inglês PTT já está operacional.");
            return;
        }

        console.log("🌱 A injetar missões base no Catálogo do Inglês PTT...");

        // A rampa clássica de 5 exercícios que usávamos no frontend
        const baseExercises = [
            { id: 'ex_1', type: 'listen_isolate', ipa: '/p/', text: "Ouça o som isolado", advTip: "Articulação: Bilabial plosiva.", audio: "p_sound" },
            { id: 'ex_2', type: 'minimal_pair', ipa: '/p/ vs /b/', text: "Qual som você ouviu?", advTip: "Diferença: Vibração.", options: ["Pat", "Bat"], answer: 0 },
            { id: 'ex_3', type: 'repeat_isolate', ipa: '/p/', text: "Grave o som /p/", advTip: "Solte o ar com força.", target: "p" },
            { id: 'ex_4', type: 'repeat_word', ipa: '/pæt/', text: "Fale a palavra", advTip: "Atenção ao som seco.", target: "pat", displayWord: "Pat" },
            { id: 'ex_5', type: 'repeat_sentence', ipa: "...", text: "Fale a frase completa", advTip: "Mantenha a fluidez.", target: "pat has a pet", displayWord: "Pat has a pet." }
        ];

        // Injeta os Nós no Banco de Dados com a lista de exercícios
        const initialNodes = [
            { nodeId: 'som_1', track: 'som', category: 'core', order: 1, title: '/p/ vs /b/', desc: 'Consoantes Bilabiais', icon: 'record_voice_over', exercises: baseExercises },
            { nodeId: 'som_2', track: 'som', category: 'core', order: 2, title: '/t/ vs /d/', desc: 'Consoantes Alveolares', icon: 'record_voice_over', exercises: [] }, // Vazio para testar bloqueio
            { nodeId: 'logica_1', track: 'logica', category: 'core', order: 1, title: 'Ordem SVO', desc: 'Estrutura Base', icon: 'account_tree', exercises: baseExercises },
            { nodeId: 'contexto_1', track: 'contexto', category: 'core', order: 1, title: 'Sobrevivência', desc: 'Básico', icon: 'directions', exercises: baseExercises },
            { nodeId: 'contexto_free_1', track: 'contexto', category: 'free', order: 0, title: 'Viagem', desc: 'Aeroporto e Hotel', icon: 'flight', exercises: baseExercises }
        ];

        await CatalogoNode.insertMany(initialNodes);
        console.log("🌲 Catálogo PTT Injetado com Sucesso!");
    }

}

module.exports = EnglishService;