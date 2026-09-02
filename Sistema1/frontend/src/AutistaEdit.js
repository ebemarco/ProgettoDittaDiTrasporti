import React, { Component } from 'react';
import { Link, withRouter } from 'react-router-dom';
import { Button, Container, Form, FormGroup, Input, Label } from 'reactstrap';
import AppNavbar from './AppNavbar';

class AutistaEdit extends Component {

    // Initial state for a new autista
    emptyItem = {
        nome: '',
        cognome: '',
        telefono: ''
    };

    constructor(props) {
        super(props);
        this.state = {
            item: this.emptyItem
        };
        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }



    /** componentDidMount function to check whether we’re dealing with the create or edit feature;
     *  in the case of editing, it’ll fetch our autista from the API */
    async componentDidMount() {
        if (this.props.match.params.id !== 'new') {
            const autista = await (await fetch(`/ditta/api/autisti/${this.props.match.params.id}`)).json();
            this.setState({item: autista});
        }
    }



    /** in the handleChange function, we’ll update our component state item property that will be used when submitting our form */
    handleChange(event) {
        const target = event.target;
        const value = target.value;
        const name = target.name;
        let item = {...this.state.item};
        item[name] = value;
        this.setState({item});
    }



    /** In handeSubmit, we’ll call our API, sending the request to a PUT or POST method depending on 
     * the feature we’re invoking. For that, we can check if the id property is filled     */
    async handleSubmit(event) {
        event.preventDefault();
        const {item} = this.state;

        /** Se id è presente in URI allora è una modifica, altrimenti è una creazione */
        const url = item.id ? '/ditta/api/autisti/' + item.id : '/ditta/api/autista';

        await fetch(url, {
            method: (item.id) ? 'PUT' : 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(item),
        });
        this.props.history.push('/ditta/api/autisti');
    }




    /** Last, but not least, our render function will be handling our form.
     * In the render function, we’ll use the react-router-dom capabilities to create
     *  a Link to route to our application Home page.
     */
    render() {
        const {item} = this.state;
        
        const isEdit = this.props.match.params.id !== 'new';

        const title = <h2>Form di {item.id ? 'Modifica Autista' : 'Aggiunta Autista'}</h2>;

        return <div>
            <AppNavbar/>
            <Container>
                {title}

                {/* Form per la creazione o modifica di un autista
                    Qui viene effettuato il submit (quindi sono presi in cosiderazione
                    i metodi POST  e PUT)
                */}
                <Form onSubmit={this.handleSubmit}>

                     {/* CAMPI COMUNI */}
                    <FormGroup className="col-md-4 mb-3">
                        <Label for="nome">Nome</Label>
                        <Input type="text" name="nome" id="nome" value={item.nome || ''}
                            onChange={this.handleChange} autoComplete="nome"/>
                    </FormGroup>
                    <FormGroup className="col-md-4 mb-3">
                        <Label for="cognome">Cognome</Label>
                        <Input type="text" name="cognome" id="cognome" value={item.cognome || ''}
                            onChange={this.handleChange} autoComplete="cognome"/>
                    </FormGroup>
                    <FormGroup className="col-md-4 mb-3">
                        <Label for="telefono">Telefono</Label>
                        <Input type="text" name="telefono" id="telefono" value={item.telefono || ''}
                            onChange={this.handleChange} autoComplete="telefono"/>
                    </FormGroup>



                    {/* CAMPI SOLO IN AGGIUNTA */}
                    { !isEdit && (
                        <>

                       
                        <FormGroup className="col-md-4 mb-3">
                            <Label for="matricola">Matricola</Label>
                            <Input type="text" name="matricola" id="matricola" value={item.matricola || ''}
                                onChange={this.handleChange} autoComplete="matricola" maxLength="5"/>
                        </FormGroup>
                       
                        <FormGroup className="col-md-4 mb-3">
                            <Label for="username">Username</Label>
                            <Input type="text" name="username" id="username" value={item.username || ''}
                                onChange={this.handleChange} autoComplete="username"/>
                        </FormGroup>

                        <FormGroup className="col-md-4 mb-3">
                            <Label for="password">Password</Label>
                            <Input type="password" name="password" id="password" value={item.password || ''}
                                onChange={this.handleChange} autoComplete="password"/>
                        </FormGroup>
                        </>
                    )}


                    <FormGroup className="col-md-4 mb-3">
                        <Button color="primary" type="submit">Salva</Button>{' '}
                        <Button color="secondary" tag={Link} to="/ditta/api/autisti">Annulla</Button>
                    </FormGroup>
                </Form>
            </Container>
        </div>
    }
}
export default withRouter(AutistaEdit);