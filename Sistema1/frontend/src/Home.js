import React, { Component } from 'react';
import './App.css';
import AppNavbar from './AppNavbar';
import { Link } from 'react-router-dom';
import { Button, Container } from 'reactstrap';


/** This component will be our application Home page, and will have a button to our previously created AutistiList component.
 *   In this component, we also have a Link from react-router-dom that leads us to /clients.
 * 
 */

class Home extends Component {
    render() {
        return (
            <div>
                <AppNavbar/>
                <Container fluid>
                    <Button color="link"><Link to="/ditta/api/autisti">Autisti</Link></Button>
                </Container>
            </div>
        );
    }
}
export default Home;