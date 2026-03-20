import React from 'react';
import ReactDOM from 'react-dom/client';
import { MasterPortal } from '../../src/renderer/components/portal/MasterPortal';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <MasterPortal />
    </React.StrictMode>
);
