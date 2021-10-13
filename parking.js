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

function checkout(){
   
}

module.exports={
    populate:populate,
    park:park,
    checkout:checkout
};