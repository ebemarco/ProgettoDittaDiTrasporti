import React, { Component } from 'react';
import { Button, ButtonGroup, Container, Table } from 'reactstrap';
import AppNavbar from './AppNavbar';
import { Link } from 'react-router-dom';

class AutistiList extends Component {

    constructor(props) {
        super(props);
        this.state = {autisti: []};
        this.remove = this.remove.bind(this);
    }

    componentDidMount() {
        fetch('/ditta/api/autisti')
            .then(response => response.json())
            .then(data => this.setState({autisti: data}));
    }


    async remove(id) {
        await fetch(`/ditta/api/autisti/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }).then(() => {
            let updatedAutisti = [...this.state.autisti].filter(i => i.id !== id);
            this.setState({autisti: updatedAutisti});
        });
    }

    render() {
        const {autisti, isLoading} = this.state;

        if (isLoading) {
            return <p>Loading...</p>;
        }

        const autistiList = autisti.map(autista => {
            return <tr key={autista.id}>
                    <td style={{whiteSpace: 'nowrap'}}>{autista.nome}</td>
                    <td>{autista.cognome}</td>
                    <td>{autista.telefono}</td>
                    <td>
                        <ButtonGroup>
                            {/* Nota bene: usare giustamente i nomi dei campi, ad es. autista.idUtente */}
                            <Button size="sm" color="primary" tag={Link} to={"/ditta/api/autisti/" + autista.idUtente}>Modifica</Button>
                            <span style={{width: '10px'}}></span> {/* Spazio tra i pulsanti */}
                            <Button size="sm" color="danger" onClick={() => this.remove(autista.idUtente)}>Elimina</Button>
                        </ButtonGroup>
                    </td>
            </tr>
        });

        return (
            <div>
                <AppNavbar/>
                <Container fluid>
                    <div className="float-end">
                        <Button color="success" tag={Link} to="/ditta/api/autisti/new">Aggiungi Autista</Button>
                    </div>  
                    <h3>Lista di tutti gli autisti</h3>
                    <Table className="mt-4">
                        <thead>
                        <tr>
                            <th width="20%">Name</th>
                            <th width="20%">Cognome</th>
                            <th width="20%">Telefono</th>
                            <th width="40%">Actions</th>
                        </tr>
                        </thead>

                       
                        <tbody>
                        {/* Stampo l'intera lista di autisti */}

                        {autistiList}

                        </tbody>
                    </Table>
                </Container>
            </div>
        );
    }
}

export default AutistiList;