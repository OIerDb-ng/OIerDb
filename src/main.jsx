import React from 'react';
import ReactDOM from 'react-dom';
import 'semantic-ui-css/semantic.min.css';
import { Container } from 'semantic-ui-react';

ReactDOM.render(
    <React.StrictMode>
        <Container>
            <div>Hello World!</div>
        </Container>
    </React.StrictMode>,
    document.getElementById('app')
);
