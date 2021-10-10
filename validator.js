
function validateInit(lot){
    const x =  parseInt( lot.sizeX);
    const y = parseInt(lot.sizeY);
    const gates = parseInt(lot.gateCount);

    let size = x*y;
    return(size-gates> gates && gates>2 && gates< 2*(x+y))
}

function validateGates(gates, lot){
    console.log(gates);
    console.log(lot);
    let err = false;
    gates.forEach(function (item) {
        console.log(item);
        if(item.x !== 1 && item.x !==lot.sizeX){
            if(item.y !== 1 && item.y !== lot.sizeY){
                err=true;
            }
        }
        console.log(err);
    });
    return !err;
}

module.exports={
    validateInit:validateInit,
    validateGates:validateGates
};