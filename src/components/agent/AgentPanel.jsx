import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_CONTEXTS = {
  '/': 'O utilizador está no Dashboard geral do NOVANOR SIS, com vista aos KPIs globais de tesouraria e estado das obras.',
  '/tesouraria': 'O utilizador está no Mapa de Tesouraria do NOVANOR SIS. Esta página mostra pagamentos a fornecedores, recebimentos de clientes, cashflow previsto e KPIs de tesouraria como saldo, pagamentos pendentes e desvio vs previsão.',
  '/obras': 'O utilizador está no módulo de Controlo de Gestão por Obra do NOVANOR SIS. Esta página mostra indicadores financeiros por obra e fase de custo, desvios, execução física vs financeira, alertas JADO e gráficos de cashflow.',
  '/fornecedores': 'O utilizador está no Workflow de Fornecedores do NOVANOR SIS. Este workflow cobre a receção de faturas, validação pelo DP, autorização de pagamento por MS e execução do pagamento pela LG.',
  '/clientes': 'O utilizador está no Workflow de Clientes do NOVANOR SIS. Este workflow cobre a emissão de faturas, validação, recebimento e atualização do Centralgest.',
  '/arquivo': 'O utilizador está no Arquivo digital do NOVANOR SIS, com acesso a faturas, obras, clientes e fornecedores arquivados.',
};

const SYSTEM_PROMPT = `És o Agente SIS da NOVANOR, um assistente de gestão financeira e operacional especializado no Sistema Integrado de Gestão (SIS) da empresa. 

Atores principais:
- CA = Carla (contabilidade, emissão de faturas)
- LG = Leonor (tesouraria, mapa de pagamentos)  
- MS = Miguel Seabra (direção, autorização de pagamentos)
- DP = Departamento de Produção (validação de faturas e obras)
- CG = Controller de Gestão
- SIS = Sistema automático (integração com Centralgest)

O SIS integra com o Centralgest (ERP) para importar diariamente: obras, fases de custo, encomendas, faturas de fornecedores, custos internos e faturação a clientes.

Responde sempre em português europeu. Sê conciso e direto. Se o utilizador pede dados específicos, indica que precisas de acesso à API em tempo real. Quando sugeres ações, indica o ator responsável (CA, LG, MS, DP).`;

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      {!isUser && (
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--brand-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#fff', flexShrink: 0, marginRight: 8, marginTop: 2,
        }}>✦</div>
      )}
      <div style={{
        maxWidth: '85%',
        padding: '8px 12px',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        background: isUser ? 'var(--brand-primary)' : 'var(--bg-app)',
        color: isUser ? '#fff' : 'var(--text-primary)',
        fontSize: 13,
        lineHeight: 1.55,
        border: isUser ? 'none' : '0.5px solid var(--border)',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AgentPanel({ open }) {
  const { pathname } = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Context changes: add a system note
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Olá! Sou o Agente SIS da NOVANOR. Posso ajudar-te a interpretar dados, navegar nos workflows, preparar JADOs, ou responder a questões sobre processos. Como posso ajudar?',
      }]);
    }
  }, [open]);

  const pageCtx = PAGE_CONTEXTS[pathname] || '';

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = next.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `${SYSTEM_PROMPT}\n\nContexto actual: ${pageCtx}`,
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      const reply = data.content?.[0]?.text || 'Erro na resposta do agente.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de ligação. Verifica a tua ligação à internet.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = {
    '/tesouraria': ['Resumir saldo actual', 'Faturas vencidas hoje', 'Cashflow próximas 2 semanas'],
    '/obras': ['Obras em alerta', 'Desvios acima de 2%', 'JADOs pendentes'],
    '/fornecedores': ['Faturas por validar DP', 'Pagamentos pendentes MS', 'Pagamentos desta semana'],
    '/clientes': ['Faturas por receber', 'Recebimentos atrasados', 'Estado faturas emitidas'],
    '/': ['Resumo do dia', 'Alertas activos', 'Próximas datas críticas'],
  };

  const suggestions = quickActions[pathname] || quickActions['/'];

  return (
    <div className={`agent-panel${open ? ' open' : ''}`}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--brand-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: '#fff',
        }}>✦</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Agente SIS</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {PAGE_CONTEXTS[pathname] ? pathname.replace('/', '') || 'Dashboard' : 'NOVANOR'}
          </div>
        </div>
        <div style={{
          marginLeft: 'auto',
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: 'var(--color-success)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)' }}/>
          activo
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
        {messages.map((m, i) => <Message key={i} msg={m} />)}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--brand-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#fff',
            }}>✦</div>
            <div style={{
              padding: '8px 12px', borderRadius: '12px 12px 12px 2px',
              background: 'var(--bg-app)', border: '0.5px solid var(--border)',
              fontSize: 13, color: 'var(--text-muted)',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              <span>A pensar</span>
              <span style={{ letterSpacing: 2 }}>···</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div style={{ padding: '10px 14px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sugestões</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => { setInput(s); }} style={{
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 6,
                border: '0.5px solid var(--border)',
                background: 'var(--bg-app)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '0.5px solid var(--border)', marginTop: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Pergunta algo ao Agente SIS..."
            style={{
              flex: 1,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              padding: '8px 10px',
              border: '0.5px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg-app)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              width: 36, height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'var(--brand-primary)',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: loading || !input.trim() ? 0.5 : 1,
              flexShrink: 0,
            }}
          >↑</button>
        </div>
      </div>
    </div>
  );
}
