import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Configcode React App</h1>
        <p style={descriptionStyle}>
          Esta interfaz está estilizada usando variables CSS (Design Tokens) del archivo <code>index.css</code>. Soporta de forma nativa temas claro y oscuro según las preferencias de tu sistema operativo.
        </p>
        <div style={actionContainer}>
          <button 
            style={buttonStyle} 
            onClick={() => setCount(prev => prev + 1)}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Clicks: {count}
          </button>
        </div>
      </div>
    </main>
  );
}

// Inline styles mapped to CSS variables
const cardStyle: React.CSSProperties = {
  backgroundColor: 'hsl(var(--card))',
  color: 'hsl(var(--card-foreground))',
  padding: '2.5rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid hsl(var(--border))',
  boxShadow: 'var(--shadow-md)',
  maxWidth: '480px',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
  transition: 'all 0.3s ease'
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 700,
  letterSpacing: '-0.025em'
};

const descriptionStyle: React.CSSProperties = {
  fontSize: '0.975rem',
  opacity: 0.8,
  lineHeight: 1.6
};

const actionContainer: React.CSSProperties = {
  marginTop: '0.5rem'
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: 'hsl(var(--primary))',
  color: 'hsl(var(--primary-foreground))',
  padding: '0.75rem 1.5rem',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.95rem',
  fontWeight: 600,
  transition: 'transform 0.1s ease',
  boxShadow: 'var(--shadow-sm)'
};
