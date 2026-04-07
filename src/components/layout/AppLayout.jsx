import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AgentPanel from '../agent/AgentPanel';

export default function AppLayout() {
  const [agentOpen,   setAgentOpen]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar agentOpen={agentOpen} setAgentOpen={setAgentOpen} open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />

      {/* Botão para reabrir sidebar quando fechada */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'fixed',
            top: 'calc(var(--topbar-height) / 2 - 28px)',
            left: 0,
            zIndex: 310, width: 20, height: 56,
            background: 'var(--brand-primary)', border: 'none', cursor: 'pointer',
            borderRadius: '0 8px 8px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10,
            boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
            transition: 'width .15s',
          }}
          title="Abrir menu"
        >›</button>
      )}

      {/* Main area */}
      <div style={{
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 0,
        marginRight: agentOpen ? 'var(--agent-width)' : 0,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-left 0.25s ease, margin-right 0.25s ease',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
      }}>
        <Topbar agentOpen={agentOpen} sidebarOpen={sidebarOpen} />

        <main style={{
          marginTop: 'var(--topbar-height)',
          padding: '24px',
          flex: 1,
          minWidth: 0,
          overflowX: 'clip',
        }}>
          <Outlet />
        </main>
      </div>

      <AgentPanel open={agentOpen} />
    </div>
  );
}
