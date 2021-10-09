
document.addEventListener('DOMContentLoaded', function() {
    const app = firebase.app()
    const db = firebase.firestore();
    const parkingLot = db.collection('ParkingLot').doc('ParkingLot');
    parkingLot.get().then(doc =>{
        const data  = doc.data()
        
        if(parseInt(data.sizeX) === 0 || parseInt(data.sizeY)||parseInt(data.gateCount)<3){
            document.write('<label>Number of Gates </label><input type=\'textbox\' id=\'gateC\' default=\'3\'></input><br><br>')
        document.write('<label>Size </label><input type=\'textbox\' id=\'xMax\'></input> by <input type=\'textbox\' id=\'yMax\'></input><br>')
        
        document.write('<button id=\'btnInit\'>Initialize</button>')

        const initBtn = document.getElementById('btnInit')

        initBtn.addEventListener("click", () => {
            parkingLot.update({
                gateCount : document.getElementById('gateC').value, 
                sizeX : document.getElementById('xMax').value, 
                sizeY : document.getElementById('yMax').value})
        });
        }
        


    });
    

});


