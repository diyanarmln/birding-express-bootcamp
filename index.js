// ================= SETUP =================

import express, { request, response } from 'express';
import methodOverride from 'method-override';
import cookieParser from 'cookie-parser';
import pg from 'pg';
import {
  add, read, write,
} from './jsonFileStorage.js';

// Initialise DB connection
const { Pool } = pg;
const pgConnectionConfigs = {
  user: 'diyanaramlan',
  host: 'localhost',
  database: 'birding',
  port: 5432, // Postgres server always runs on this port by default
};
const pool = new Pool(pgConnectionConfigs);

const app = express();
app.use(cookieParser());
app.set('view engine', 'ejs');
app.use(express.static('public'));
// Override POST requests with query param ?_method=PUT to be PUT requests
app.use(methodOverride('_method'));
// Configure Express to parse request body data into request.body
app.use(express.urlencoded({ extended: false }));

// =============== ROUTE HELPER FUNCTIONS ===============

// Save new note sent via POST request from our form
app.post('/note', (request, response) => {
  const content = request.body;

  content.creationDate = Date();

  // Add new note in request.body to DB
  const inputHabitat = content.habitat;
  const inputDate = content.date;
  const inputDuration = content.duration;
  const inputAppearance = content.appearance;
  const inputGender = content.gender;
  const inputBehaviour = content.behaviour;
  const inputVocals = content.vocalisation;
  const inputFlock = content.flock;

  const inputData = [inputHabitat, inputDate, inputDuration, inputAppearance, inputGender, inputBehaviour, inputVocals, inputFlock];
  const sqlInsert = 'INSERT INTO notes (habitat, date, duration_mins, appearance, gender, behaviour, vocalisations, flock_size) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';

  pool.query(sqlInsert, inputData, (error, result) => {
    if (error) {
      response.status(500).send('DB write error.');
      console.log('DB write error', error.stack);
      return;
    }

    console.log('query inserted', result);
    // retrieve id of last insert
    let insertID = 0;
    pool.query('select id from notes order by 1 desc limit 1;', (error3, result3) => {
      console.log(result3.rows[0].id);
      insertID = result3.rows[0].id;
      response.redirect(`/note/${insertID}`);
    });
  });
});

// render form submission page
const renderForm = (request, response) => {
  const content = {
    dateValidity: '',
    durationValidity: '',
    habitatValidity: '',
    appearanceValidity: '',
    genderValidity: '',
    behaviourValidity: '',
    vocalisationValidity: '',
    flockValidity: '',
  };
  response.render('form', content);
};

// render single page showing one note
const renderNotePage = (request, response) => {
  const { id } = request.params;
  pool.query(`SELECT * FROM notes where id = ${id};`, (err, res) => {
    const content = res.rows[0];
    console.log(content);
    response.render('note', content);
  });
};

// render home page with list of sightings
const renderHomePage = (req, res) => {
  let visits = 0;

  // check if it's not the first time a request has been made
  if (req.cookies.visits) {
    console.log(req.cookies);
    visits = Number(req.cookies.visits); // get the value from the request
  }

  // set a new value of the cookie
  visits += 1;

  res.cookie('visits', visits); // set a new value to send back
  const content = [];

  content.visits = visits;
  pool.query('SELECT * FROM notes;', (err, result) => {
    const notes = result.rows;
    content.notes = notes;

    res.render('home', content);
  });
};

// render edit note page
const handleEditNote = (request, response) => {
  const { id } = request.params;
  const formValidity = {
    dateValidity: '',
    durationValidity: '',
    habitatValidity: '',
    appearanceValidity: '',
    genderValidity: '',
    behaviourValidity: '',
    vocalisationValidity: '',
    flockValidity: '',
  };
  pool.query(`SELECT * FROM notes where id = ${id};`, (err, res) => {
    const content = res.rows[0];
    content.url = request.url;
    content.validity = formValidity;
    console.log(content);
    response.render('edit', content);
  });
};

// handle edit submissions and redirect to sighting page
const handleFileReadPostEdit = (request, response) => {
  const content = request.body;
  const { id } = request.params;

  // Add new note in request.body to DB
  const inputHabitat = content.habitat;
  const inputDate = content.date;
  const inputDuration = content.duration;
  const inputAppearance = content.appearance;
  const inputGender = content.gender;
  const inputBehaviour = content.behaviour;
  const inputVocals = content.vocalisation;
  const inputFlock = content.flock;

  const sqlUpdate = `UPDATE notes SET habitat='${inputHabitat}', date='${inputDate}', duration_mins='${inputDuration}', appearance='${inputAppearance}', gender='${inputGender}', behaviour='${inputBehaviour}', vocalisations='${inputVocals}', flock_size='${inputFlock}' WHERE id=${id};`;

  pool.query(sqlUpdate, (error, result) => {
    if (error) {
      response.status(500).send('DB write error.');
      console.log('DB write error', error.stack);
      return;
    }

    console.log('query updated', result);
    response.redirect(`/note/${id}`);
  });
};

// delete note
const handleFileReadDelete = (request, response) => {
  const { id } = request.params;

  const sqlDelete = `DELETE FROM notes WHERE id=${id};`;

  pool.query(sqlDelete, (error, result) => {
    if (error) {
      response.status(500).send('DB write error.');
      console.log('DB write error', error.stack);
      return;
    }

    console.log('record deleted', result);
    response.redirect('/');
  });
};

const handleLoginPage = (request, response) => {
  response.render('login');
};

const handleSignUpPage = (request, response) => {
  response.render('signup');
};

app.post('/signup', (request, response) => {
  const content = request.body;
  console.log(content);

  // check table if email is unique
  const sqlCheck = `SELECT * FROM users where email = '${content.email}';`;

  pool.query(sqlCheck, (err, res) => {
    console.log(res);
    if (res.rows.length > 0) {
      response.status(400).send('Email already exists.');
      console.log('Email exists');
    }
    else {
      const inputData = [content.email, content.password];
      const sqlInsert = 'INSERT INTO users (email, password) VALUES ($1, $2);';

      pool.query(sqlInsert, inputData, (error, result) => {
        if (error) {
          response.status(500).send('DB write error.');
          console.log('DB write error', error.stack);
          return;
        }

        console.log('query inserted', result);
        response.status(200).send('Account created');
      });
    }
  });
});

app.post('/login', (request, response) => {
  const content = request.body;
  console.log(content);
  const sqlCheck = `SELECT * FROM users WHERE email = '${content.email}' AND password = '${content.password}';`;

  pool.query(sqlCheck, (err, res) => {
    console.log(res);
    if (res.rows.length === 0) {
      response.status(400).send('Your email/password does not exist.');
      console.log('Email/password does not exist');
    }
    else {
      const user = res.rows[0];
      response.cookie('userId', user.id);
      const insertNoteSQL = `UPDATE users SET note = ${user.id} where id = ${user.id};`;

      pool.query(insertNoteSQL, (error, result) => {
        if (error) {
          response.status(500).send('DB write error.');
          console.log('DB write error', error.stack);
          return;
        }

        console.log('login note cookie success', result);
        response.redirect('/account');
      });
    }
  });
});

const handleAccountPage = (request, response) => {
  response.render('account');
};

const handleLogOut = (reqOut, resOut) => {
  const id = reqOut.cookies.userId;

  const sqlDelete = `UPDATE users SET note='' WHERE note='${id}';`;

  pool.query(sqlDelete, (error, result) => {
    if (error) {
      resOut.status(500).send('DB write error.');
      console.log('DB write error', error.stack);
      return;
    }

    console.log('logout cookie updated', result);
    resOut.clearCookie('userId');
    resOut.redirect('/login');
  });
};

app.get('/', renderHomePage);
app.get('/note/:id', renderNotePage);
app.get('/note', renderForm);
app.get('/note/:id/edit', handleEditNote);
app.put('/note/:id', handleFileReadPostEdit);
app.delete('/note/:id', handleFileReadDelete);
app.get('/login', handleLoginPage);
app.get('/signup', handleSignUpPage);
app.get('/account', handleAccountPage);
app.get('/logout', handleLogOut);

app.listen(3004);
