// note this sketch knows nothing about the fact that its call
// buildFilterShader() / modify() call will be intercepted
let myShader;

function setup() {
    createCanvas(300, 300, WEBGL);
    myShader = buildFilterShader(invertFilter);
}

function draw() {
    filter(myShader);
}

function invertFilter() {
    filterColor.begin();
    filterColor.set([(1 + sin(millis() / 1000)) / 2, 0, 1, 1]);
    filterColor.end();
}
