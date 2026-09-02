import React, { Component } from 'react';
import './App.css';
import Home from './Home';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import AutistiList from './AutistiList';
import AutistaEdit from './AutistaEdit';

class App extends Component {
  render() {
    return (
        <Router>
          <Switch>
            <Route path='/' exact={true} component={Home}/>
            <Route path='/ditta/api/autisti' exact={true} component={AutistiList}/>
            <Route path='/ditta/api/autisti/:id' component={AutistaEdit}/>
          </Switch>
        </Router>
    )
  }
}

export default App;