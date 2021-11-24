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
const observer = db.collection('Vehicles') // listener for checkout, to automatically release parking slot
.onSnapshot(querySnapshot => {
  querySnapshot.docChanges().forEach(change => {
    if (change.type === 'modified') {
        const modifiedData = change.doc.data();
        console.log(modifiedData);     
        if(modifiedData.hasOwnProperty('datetimeout')){
            let parkingSlots =db.collection('ParkingSlots').doc(modifiedData.parkingslotXY);
            parkingSlots.get().then(doc => {
                const parkingSlot  = doc.data();
                if (parkingSlot) {
                    parkingSlot.occupied=0;
                    parkingSlots.set(parkingSlot);
                }
            });
        }
    }
  });
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
            const parkingSlots = parking.populateRandomSize(lot,req.body);
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
            });
            batch.commit();
            return(res.status(200).send('gates initialized. parking lot map generated.'))   
        }
        return(res.status(400).send('Invalid gate x,y coordinates. Gates must be at perimeter edge of the parking lot'))
    });
});

//override parking slot values
app.post('/override',async (req,res) =>{
    const parkingLot = db.collection('ParkingLot').doc('ParkingLot');
    const doc = await parkingLot.get();
    const data  = doc.data();
    const lot = {
        sizeX : data.sizeX,
        sizeY : data.sizeY,
        gateCount : data.gateCount
    }
    let parkingSlots = [];
    //validate values
    if(validator.validateParkingSlots(req.body,lot)){
        const reqdata = req.body;
        reqdata.forEach(function (item) {
            xyArray = item.xy.split(',');
            let slotData = {
                occupied:0,
                size:item.size,
                x:parseInt(xyArray[0]),
                y:parseInt(xyArray[1])
            };
            item.distances.forEach(function(distance){
                slotData[Object.keys(distance)[0]]=Object.values(distance)[0];
            });
            console.log(slotData);
            parkingSlots.push(slotData);
           });
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
        });
        batch.commit();
        return(res.status(200).send('parking slots set.'));
    }
    return(res.status(400).send('Invalid input. Please check that the number of parking slots for override does not exceed existing slots. And number of distances per slot must not exceed number of gates'));
});

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
            let isParked = false;
            if(!result.error){
                //check for already parked plateno
                const vehicles = db.collection('Vehicles').doc(req.body.plateno);
                vehicles.get().then(vehicleDoc => {
                    const vehicle = vehicleDoc.data();
                    let timeIn =new Date();
                    if(vehicle){
                        if(!vehicle.hasOwnProperty('datetimeout'))
                            throw new Error('Vehicle already checked in.');
                        let diffInMillis = (timeIn.getTime()) - (vehicle.datetimeout.seconds*1000);
                        if(diffInMillis < 60 * 60 * 1000)
                            timeIn = vehicle.datetimeout;
                    }
                    let sizes = new Array;
                    let h=req.body.size;
                    while(sizes.length!=3-(req.body.size))
                    {
                        sizes.push(h);h++;
                    }
                    const snapshot = db.collection("ParkingSlots").where('occupied','==',0).where('size','in',sizes).orderBy(''+req.body.gate).limit(1)
                    snapshot.get().then(doc =>{
                        if(doc.size>0){
                            doc.forEach(doc1 => {
                                let parkingSlot = doc1.data();
                                parkingSlot.occupied=1;//set lot to occupied
                                const parkSlotId=parkingSlot.x+','+parkingSlot.y;
                                const vehicle = {
                                    size: req.body.size,
                                    gate: req.body.gate,
                                    datetimein: timeIn,
                                    parkingslotXY:parkSlotId,
                                    parkingslotsize:parkingSlot.size
                                }
                                const vehicles = db.collection('Vehicles').doc(req.body.plateno);
                                vehicles.set(vehicle);
                                const parkingSlots = db.collection('ParkingSlots').doc(parkSlotId);
                                parkingSlots.set(parkingSlot);
                                return(res.status(200).send('Vehicle parked.'));
                            });    
                        }else{throw new Error("No more parking slots available for this vehicle.")}
                    }).catch(e=>{return(res.status(400).send(e.message));});
                    
                }).catch(e=>{return(res.status(400).send(e.message));});
            }else
                throw new Error(result.error.details[0].message);
        }).catch(e=>{return(res.status(400).send(e.message));});
    }catch(error) {
        return(res.status(400).send(error.message));
    }
});

app.post('/checkout',async (req,res) =>{
    const schema =Joi.object({
        plateno:Joi.string().required(),
    });
    try{
        const result = schema.validate(req.body);
        if(!result.error){
            const vehicles = db.collection('Vehicles').doc(req.body.plateno);
            const doc = await vehicles.get();
            if(doc){
                let parkingFee=40;
                let checkOutTime = new Date();
                const vehicle = {size, gate, datetimein,datetimeout,parkingslotXY,parkingslotsize}=doc.data();
                if(vehicle.hasOwnProperty('datetimeout'))
                    throw new Error('Vehicle not parked.');
                
                let parkedHours = Math.ceil((checkOutTime-(vehicle.datetimein.seconds*1000))/3600000);
                let isWithinDay = parkedHours<=24;
                if(parkedHours > 3){
                    parkingFee = parking.getParkingFee(vehicle, parkedHours,isWithinDay);
                }
                vehicle['datetimeout']=checkOutTime;
                vehicles.set(vehicle);
                return(res.status(200).send(`Vehicle checked out successfully. Fee = ${parkingFee}`));
            }
            throw new Error('Vehicle not found.');
        }
        throw new Error(result.error.details[0].message);
    }catch(e){
        return(res.status(400).send(e.message));
    }
});
//initiate parking lot map details
app.delete('/purge', async (req,res) =>{
    purgeCollection('ParkingLot');
    purgeCollection('ParkingSlots');
    purgeCollection('Gates');
    purgeCollection('Vehicles');
    return(res.status(200).send('Purged Firestore Collections'));
});

function purgeCollection(collectionName){
    db.collection(collectionName).get().then(querySnapshot => {
        querySnapshot.docs.forEach(snapshot => {
            snapshot.ref.delete();
        })
    })
}