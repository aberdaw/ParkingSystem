const compute = require('./compute');

function populate(lot,gates){
   let parkingSlots = new Array();
    for(x=1;x<=lot.sizeX;x++){
        for(y=1;y<=lot.sizeY;y++){
            const coord = {
                x:x,
                y:y
            }
            if(!gates.some(e => e.x === coord.x && e.y ===coord.y)){
                let parkingSlot = {
                    x:x,
                    y:y,
                    size:compute.randomizeSize(),
                    occupied:0,
                }
                gates.forEach(function (item) {
                   parkingSlot[gates.indexOf(item)]=compute.getDistance(x-item.x,y-item.y)
                });
                parkingSlots.push(parkingSlot);
            }
        }
   }
  return parkingSlots;
}

function park(){
   
}

function getParkingFee(vehicle, parkedHours, isWithinDay=false, accumulator=0){
    console.log(parkedHours)
    console.log(isWithinDay);
    console.log(accumulator);
    if(parkedHours<24){
        if(isWithinDay)
        return ((20+(vehicle.parkingslotsize*40))*(parkedHours-3)+40).toFixed(2);
        else
        return (accumulator+ (20+(vehicle.parkingslotsize*40))*(parkedHours)).toFixed(2);
    }
    else
        return  getParkingFee(vehicle, parkedHours-24, isWithinDay, 5000 + accumulator)
}

module.exports={
    populate:populate,
    park:park,
    getParkingFee:getParkingFee
};