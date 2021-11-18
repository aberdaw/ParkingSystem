
function validateInit(lot){
    const x =  parseInt( lot.sizeX);
    const y = parseInt(lot.sizeY);
    const gates = parseInt(lot.gateCount);

    let size = x*y;
    return(size-gates> gates && gates>2 && gates< 2*(x+y))
}

function validateGates(gates, lot){
    let err = false;
    gates.forEach(function (item) {
        if(item.x !== 1 && item.x !==lot.sizeX){
            if(item.y !== 1 && item.y !== lot.sizeY){
                err=true;
            }
        }
    });
    return !err;
}

function validateParkingSlots(slots, lot){
    let err = true;
    if(slots.length<=(lot.sizeX*lot.sizeY)-lot.gateCount){
        slots.forEach(function (item) {
            if(item.size<3 && item.size>=0 && item.distances.length<=lot.gateCount)
            {
                err=false;
            }
        });
    }
    return !err;
}

module.exports={
    validateInit:validateInit,
    validateGates:validateGates,
    validateParkingSlots:validateParkingSlots
};