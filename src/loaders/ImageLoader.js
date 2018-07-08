/**
 * Created by Ziga on 18.4.2016
 * Source: three.js
 */

LOGI.ImageLoader = class {

	constructor(manager) {
		this.manager = manager || new LOGI.LoadingManager();
	}

	load(url, onLoad, onProgress, onError) {

		// Self reference
		var scope = this;

		// Check if root path is set
		if (this.path !== undefined) {
			url = this.path + url;
		}

		// Notify img started loading
		this.manager.itemStart(url);

		// Check if the image is already cached
		var cached = LOGI.Cache.get(url);

		if (cached !== undefined) {
			if (onLoad) {
				// Async
				setTimeout(function() {
					onLoad(cached);
					scope.manager.itemEnd(url);
				}, 0);
			} else {
				scope.manager.itemEnd(url);
			}

			return cached;
		}

		// Create new image
		var image = new Image();
		image.src = url;

		// onLoad listener
		image.addEventListener('load', function(event) {
			scope.manager.itemEnd(url);

			// Cache loaded image
			LOGI.Cache.add(url, this);

			// Return the loaded image
			if (onLoad !== undefined) {
				onLoad(image);
			}
		});

		// onProgress listener
		image.addEventListener('progress', function(event) {
			if (onProgress !== undefined) {
				onProgress(event);
			}
		});

		// onError listener
		image.addEventListener('error', function(event) {
			if (onError) {
				onError(event);
			}

			scope.manager.itemError(url);
		});

		if (this.crossOrigin !== undefined) {
			image.crossOrigin = this.crossOrigin;
		}
	}

	setCrossOrigin(value) {
		this.crossOrigin = value;
	}

	setPath(value) {
		this.path = value;
	}

};