function randomizeSize(){
    return Math.floor(Math.random() * 3);
}

function getDistance(a,b){
    return Math.hypot(a,b);
}


module.exports={
    randomizeSize:randomizeSize,
    getDistance:getDistance
};

function getParkingFee(vehicle, parkedHours){
    return (20+(vehicle.parkingslotsize*40))*parkedHours;
}