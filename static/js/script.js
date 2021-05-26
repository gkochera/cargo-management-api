function copyToClipboard() {
    var jwt = document.getElementById("jwt").innerText;
    var aux = document.createElement("input");
    aux.setAttribute("value", jwt);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand("copy");
    document.body.removeChild(aux);

    var message = document.getElementById("notice")
    message.style.display = 'block';
}   

document.querySelector("#jwt-copy").addEventListener("click", copyToClipboard);