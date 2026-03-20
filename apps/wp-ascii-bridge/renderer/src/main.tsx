import React from 'react';
import ReactDOM from 'react-dom/client';
import { AutoRenderer, useAsciiState } from '@ascii-world/renderer';

function App() {
    const { view, sendControl } = useAsciiState('http://localhost:3450');

    return (
        <div className="wp-bridge-container">
            <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>WordPress Spatial Bridge</h1>
            <AutoRenderer 
                ascii={view} 
                onControl={(label) => sendControl({ label })} 
            />
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
