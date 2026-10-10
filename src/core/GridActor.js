// Ortak ızgara aktörü: oyuncu ve hayalet hareket verileri aynı biçimdedir.
export class GridActor {
  constructor(col, row, dir = "left") {
    this.col = col;
    this.row = row;
    this.dir = dir;
    this.progress = 0;
    this.moving = false;
  }
}
