const Joi = require('joi');
const express = require('express');
const Firestore = require('@google-cloud/firestore');
const projectId = 'parkinglot-439a6'
const keyFilename = 'C:\\Users\\amado\\Documents\\GitHub\\ParkingSystem\\parkinglot-439a6-2df31881982e.json'
const db= new Firestore({projectId, keyFilename});
const validator = require('./validator.js');  
const parking = require('./parking.js');
const { array } = require('joi');

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
            
            const BATCH_SIZE = 500;
            let batch = db.batch();
            let j = 0;
            parkingSlots.forEach(p => {
                var ref = db.collection('ParkingSlots').doc(`${p.x},${p.y}`);
                batch.set(ref, p);
                if (j === BATCH_SIZE) {
                    batch.commit();
                    batch = db.batch();
                    j = 0; // Reset
                  } else j++;
                
            })
            batch.commit();
            return(res.status(200).send('gates initialized. parking lot map generated.'))
        }
        return(res.status(400).send('Invalid gate x,y coordinates. Gates must be at perimeter edge of the parking lot'))
    });
})

app.post('/park',async (req,res) =>{
    try {
        const parkingLot = db.collection('ParkingLot').doc('ParkingLot');
        parkingLot.get().then(doc => {
            const data  = doc.data();
            const lot = {
                sizeX : data.sizeX,
                sizeY : data.sizeY,
                gateCount : data.gateCount
            }//pulled for joi validation on gate count
            const schema =Joi.object({
                plateno:Joi.string().required(),
                size:Joi.number().integer().required().max(2),
                gate: Joi.number().integer().required().max(lot.gateCount-1)
            });
            const result = schema.validate(req.body);
            if(!result.error){
                //check for already parked plateno
                let vehicle=null;
                const vehicles = db.collection('Vehicles').doc(req.body.plateno);
                vehicles.get().then(doc => {
                    if(doc)
                        vehicle = doc.data();
                });
                if(vehicle !== null) 
                    if(!vehicle.hasOwnProperty('datetimeout'))
                        throw new Error('Vehicle already checked in.');
                //workaround for firestore query limitation on where and order by
                let sizes = new Array;
                let h=req.body.size;
                while(sizes.length!=3-(req.body.size))
                {
                    sizes.push(h);h++;
                }

                const snapshot = db.collection("ParkingSlots").where('occupied','==',0).where('size','in',sizes).orderBy(''+req.body.gate).limit(1)
                snapshot.get().then(doc =>{
                    if(doc){
                        doc.forEach(doc1 => {
                            let parkingSlot = doc1.data();
                            parkingSlot.occupied=1;//set lot to occupied
                            const parkSlotId=parkingSlot.x+','+parkingSlot.y;
                            const vehicle = {
                                size: req.body.size,
                                gate: req.body.gate,
                                datetimein: new Date(),
                                parkingslotXY:parkSlotId
                            }
                            const vehicles = db.collection('Vehicles').doc(req.body.plateno);
                            vehicles.set(vehicle);
                            const parkingSlots = db.collection('ParkingSlots').doc(parkSlotId);
                            parkingSlots.set(parkingSlot);
                            return(res.status(200).send('Vehicle parked.'));
                        });    
                    }else{throw new Error("No more parking slots available for this vehicle.")}
                });
            }else
                throw new Error(result.error.details[0].message);
        });
    }catch(error) {
        return(res.status(400).send(error.message));
    }
});

app.post('/checkout',async (req,res) =>{
    const schema =Joi.object({
        plateno:Joi.string().required(),
    });
    const result = schema.validate(req.body);
    if(!result.error){
        const vehicles = db.collection('Vehicles').doc(req.body.plateno);
        const doc = await vehicles.get();
        if(doc){
            console.log(doc.data());
        }
        return(res.status(400).send('Vehicle not found.'));
    }
    return(res.status(400).send(result.error.details[0].message));
});