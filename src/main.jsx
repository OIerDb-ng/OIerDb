import React from 'react';
import ReactDOM from 'react-dom';

// Semantic UI
import 'semantic-ui-css/semantic.min.css';
import { Container } from 'semantic-ui-react';

// Components
import Header from './components/Header';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';

// Styles
import './main.css';

ReactDOM.render(
    <React.StrictMode>
        <Header />
        <Container style={{ paddingTop: '1.5rem' }}>
            <Home />
        </Container>
        <Footer />
    </React.StrictMode>,
    document.getElementById('app')
);
