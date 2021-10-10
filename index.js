const Joi = require('joi');
const express = require('express');
const Firestore = require('@google-cloud/firestore');
const projectId = 'parkinglot-439a6'
const keyFilename = 'C:\\Users\\amado\\Documents\\GitHub\\ParkingSystem\\parkinglot-439a6-2df31881982e.json'
const db= new Firestore({projectId, keyFilename});
const validator = require('./validator.js');  
const parking = require('./parking.js')

const app = express();
app.use(express.json());
const port =process.env.PORT || 2000

app.listen(port,() =>{
    console.log(`Listening to port ${port}`);
    
});

//parking system status - later add number of remaining slots,other details
app.get('/', async (req,res)=>{
    const parkingLot = db.collection('ParkingLot').doc('ParkingLot');
    parkingLot.get().then(doc =>{
       const data  = doc.data()
       
        if(parseInt(data.sizeX) === 0 || parseInt(data.sizeY) === 0||parseInt(data.gateCount)<3){
           return res.status(400).send('Parking Lot not yet initialized. Set size and number of gates');
        }
        else{
            return res.status(200).send(`status: x=${data.sizeX} y = ${data.sizeY} gates = ${data.gateCount}`);
        }
        
    });
});

//initiate parking lot map details
app.post('/init', async (req,res) =>{
    const schema =Joi.object({
        x:Joi.number().integer().positive().required().min(1),
        y:Joi.number().integer().positive().required().min(1),
        gates:Joi.number().integer().positive().required().min(3)
    });
    const result = schema.validate(req.body);
    if(!result.error){
        const lot = {
            sizeX : req.body.x,
            sizeY : req.body.y,
            gateCount : req.body.gates
        }
        //validate values for physical impossibility on a parking lot.
        if(validator.validateInit(lot)){
            //initialize parking lot details
            const parkingLot = db.collection('ParkingLot').doc('ParkingLot');
            parkingLot.set(lot);
            return(res.status(200).send('initialized lot'));
        }
        return(res.status(400).send('Invalid values. Number of gates must not exceed perimeter of the lot and there must be more parking slots than gates.'));
    }
    return(res.status(400).send(result.error.details[0].message));
});
//initialize parking gates
app.post('/gates',async (req,res) =>{
    const parkingLot = db.collection('ParkingLot').doc('ParkingLot');
    parkingLot.get().then(doc =>{
        const data  = doc.data();
        const lot = {
            sizeX : data.sizeX,
            sizeY : data.sizeY,
            gateCount : data.gateCount
        }
        const schema = Joi.array()
        .items({
            x:Joi.number().positive().integer().required().max(lot.sizeX),
            y:Joi.number().positive().integer().required().max(lot.sizeY),
        }).unique().length(lot.gateCount); //number of gates in array must be equal to gateCount

        const result= schema.validate(req.body);
        if(result.error)
            return(res.status(400).send(result.error.details[0].message));
        //validate values, gates must be at perimeter edge of the parking lot
        if(validator.validateGates(req.body,lot)){
            const reqdata = req.body;
            reqdata.forEach(function (item) {
                const res = db.collection('Gates').doc(`${reqdata.indexOf(item)}`).set({
                    x: item.x,
                    y: item.y,
                  });
            });
            //was going to use google functions to automatically trigger generation of parking slots but it required payment already
            const parkingSlots = parking.populate(lot,req.body);
            
            const batch = db.batch();
            parkingSlots.forEach(p => {
                var ref = db.collection('ParkingSlots').doc(`${p.x},${p.y}`);
                batch.set(ref, p);
            })
            batch.commit();

            return(res.status(200).send('gates initialized. parking lot map generated.'))
        }
        return(res.status(400).send('Invalid gate x,y coordinates. Gates must be at perimeter edge of the parking lot'))
    });
})