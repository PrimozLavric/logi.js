/**
 * Created by Ziga on 25.3.2016.
 */

LOGI.Camera = class extends LOGI.Object3D {

	constructor() {
		super(LOGI.Object3D);

        this.type = "Camera";

		this._matrixWorldInverse = new THREE.Matrix4();
		this._projectionMatrix = new THREE.Matrix4();

		// Camera up direction
		this._up = new THREE.Vector3(0, 1, 0);
	}

    get projectionMatrix () { return this._projectionMatrix; }
	get up() { return this._up; }

    get matrixWorldInverse () { return this._matrixWorldInverse; }
    set matrixWorldInverse (inverse) { this._matrixWorldInverse = inverse; }
};