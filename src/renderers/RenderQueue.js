/**
 * Created by Primoz on 26-Nov-16.
 */

LOGI.RenderQueue = class {

    constructor(renderer) {
        this._renderer = renderer;

        // Rendering sequences that are used often can be stored for quick access
        this._storedRenderQueues = {};

        // Queue for render passes. When render() is called this queue is executed in FIFO order
        this._renderQueue = [];

        // Maps ID (string) to texture
        this._textureMap = {};
        // Additional data passed through by previous render passe
        this._forwardedAdditionalData = {};

        // Init merge texture resources
        this._textureMergeScene = new LOGI.Scene();
        this._textureMergeQuad = new LOGI.Quad(new THREE.Vector2(-1, 1), new THREE.Vector2(1, -1), new LOGI.MeshBasicMaterial());
        this._textureMergeQuad.frustumCulled = false;
        this._textureMergeCamera = new LOGI.OrthographicCamera(-1, 1, 1, -1, 1, 2);

        this._textureMergeScene.add(this._textureMergeQuad);

        // Init render target
        this._renderTarget = new LOGI.RenderTarget(1920, 1080);
    }

    _setupRenderTarget(renderPass) {
        let viewportRP = renderPass.viewport;

        // Clear previous draw buffers from the render target
        this._renderTarget.clearDrawBuffers();

        // Set viewport dimensions
        this._renderTarget.width = viewportRP.width;
        this._renderTarget.height = viewportRP.height;

        // Check if depth texture is requested
        if (renderPass.outDepthID !== null) {
            let cachedTexture = this._textureMap[renderPass.outDepthID];

            // If texture with this ID is already cached use that texture
            if (cachedTexture !== undefined) {
                this._renderTarget.depthTexture = cachedTexture;

                // Update dimensions
                this._renderTarget.depthTexture.width = viewportRP.width;
                this._renderTarget.depthTexture.height = viewportRP.height;
            }
            else {
                this._renderTarget.addDepthTexture();
                // Bind depth texture to ID
                this._textureMap[renderPass.outDepthID] = this._renderTarget.depthTexture;
            }
        }

        // Bind color output textures
        for (let i = 0; i < renderPass.outTextures.length; i++) {

            let texTemplate = renderPass.outTextures[i];
            let texID = texTemplate.id;
            let texConfig = texTemplate.textureConfig;

            // Check if this texture is already cached
            let cachedTexture = this._textureMap[texID];

            // If texture with this ID is already cached use that texture
            if (cachedTexture !== undefined) {
                // Update texture parameters
                cachedTexture.applyConfig(texConfig);

                // Update dimensions
                cachedTexture.width = viewportRP.width;
                cachedTexture.height = viewportRP.height;

                // Add texture ass draw buffer to render target
                this._renderTarget.addDrawBuffer(cachedTexture);
            }
            else {
                // Create new texture
                let texture = new LOGI.Texture(undefined, texConfig.wrapS, texConfig.wrapT, texConfig.minFilter, texConfig.magFilter,
                    texConfig.internalFormat, texConfig.format, texConfig.type, viewportRP.width, viewportRP.height);

                this._renderTarget.addDrawBuffer(texture);
                // Bind depth texture to the given ID ID
                this._textureMap[texID] = texture;
            }
        }
    }

    render() {
        // Store current renderer viewport
        let cleanupViewport = this._renderer.getViewport();

        for (let i = 0; i < this._renderQueue.length; i++) {
            let renderPass = this._renderQueue[i];

            // Check if the render pass is initialized
            if (!renderPass._isInitialized) {
                renderPass._initialize(this._textureMap, this._forwardedAdditionalData);
                renderPass._isInitialized = true;
            }

            let viewportRP = renderPass.viewport;

            // Execute preprocess step
            let preprocOutput = renderPass.preprocess(this._textureMap, this._forwardedAdditionalData);

            // If prepossessing step outputs null skip this render pass.
            if (preprocOutput === null) {
                continue;
            }

            // Determine the render pass type
            if (renderPass.type === LOGI.RenderPass.BASIC) {
                // This is a BASIC scene rendering render pass

                // Validate preprocess output
                if (preprocOutput.scene === undefined || !(preprocOutput.scene instanceof LOGI.Scene) ||
                    preprocOutput.camera === undefined || !(preprocOutput.camera instanceof LOGI.Camera)) {
                    console.error("Render pass " + i + " has invalid preprocess output!");
                    return;
                }

                // Render to specified target
                if (renderPass.target === LOGI.RenderPass.SCREEN) {
                    // RENDER TO SCREEN
                    // Set requested viewport
                    this._renderer.updateViewport(viewportRP.width, viewportRP.height);

                    // Render to screen
                    this._renderer.render(preprocOutput.scene, preprocOutput.camera);
                }
                else if (renderPass.target === LOGI.RenderPass.TEXTURE) {
                    // RENDER TO TEXTURE
                    // Setup render target as the render pass specifies
                    this._setupRenderTarget(renderPass);

                    // Render to render target
                    this._renderer.render(preprocOutput.scene, preprocOutput.camera, this._renderTarget)
                }
                else {
                    console.error("Unknown render pass " + i + " target.");
                    return;
                }
            }
            else if (renderPass.type === LOGI.RenderPass.TEXTURE_MERGE) {
                // This is a texture merging render pass

                // Validate preprocess output
                if (preprocOutput.material === undefined || !(preprocOutput.material instanceof LOGI.CustomShaderMaterial) ||
                    preprocOutput.textures === undefined || !Array.isArray(preprocOutput.textures)) {
                    console.error("Render pass " + i + " has invalid preprocess output!");
                    return;
                }

                // Remove possible previous maps
                preprocOutput.material.clearMaps();

                // Add textures to material
                for (let i = 0; i < preprocOutput.textures.length; i++) {
                    preprocOutput.material.addMap(preprocOutput.textures[i]);
                }

                // Set quad material so that the correct shader will be used
                this._textureMergeQuad.material = preprocOutput.material;

                // Render to specified target
                if (renderPass.target === LOGI.RenderPass.SCREEN) {
                    // RENDER TO SCREEN
                    // Set requested viewport
                    this._renderer.updateViewport(viewportRP.width, viewportRP.height);

                    // Render to screen
                    this._renderer.render(this._textureMergeScene, this._textureMergeCamera);
                }
                else if (renderPass.target === LOGI.RenderPass.TEXTURE) {
                    // RENDER TO TEXTURE
                    // Setup render target as the render pass specifies
                    this._setupRenderTarget(renderPass);

                    // Render to render target
                    this._renderer.render(this._textureMergeScene, this._textureMergeCamera, this._renderTarget)
                }
                else {
                    console.error("Unknown render pass " + i + " target.")
                    return;
                }
            }
            else {
                console.error("Render queue contains RenderPass of unsupported type!");
                return;
            }
        }

        // Restore viewport to original value
        this._renderer.updateViewport(cleanupViewport.width, cleanupViewport.height);

        return {textures: this._textureMap,
                additionalData: this._forwardedAdditionalData};
    }

    addTexture(name, texture) {
        this._textureMap[name] = texture;
    }

    setDataValue(name, value) {
        this._forwardedAdditionalData[name] = value;
    }

    // region QUEUE CONSTRUCTION
    /**
     * Creates the render queue from the given array of render passes
     */
    setRenderQueue(queue) {
        // Validate the given queue
        for (let i = 0; i < queue.length; i++) {
            if (!(queue[i] instanceof LOGI.RenderPass)) {
                console.error("Given render queue contains invalid elements!");
                return;
            }
        }

        this._renderQueue = queue;
    }

    /**
     * Removes all the RenderPasses from the queue
     */
    clearRenderQueue() {
        this._renderQueue = [];
    }

    /**
     * Adds new LOGI.RenderPass to the end of the queue
     */
    pushRenderPass(renderPass) {
        // Validate renderPass
        if (!(renderPass instanceof LOGI.RenderPass)) {
            console.error("Given argument is not a RenderPass!");
            return;
        }

        this._renderQueue.push(renderPass);
    }

    /**
     * Removes the Render Pass from the render queue.
     */
    removeRenderPass(renderPass) {
        let index = this._renderQueue.indexOf(renderPass);

        if (index > -1) {
            this._renderQueue.splice(index, 1);
        }
    }

    /**
     * Adds render pass at given index.
     */
    addRenderPass(renderPass, index) {
        this._renderQueue.splice(index, 0, renderPass);
    }

    /**
     * Pops last render pass in the render queue
     */
    popRenderPass() {
        return this._renderQueue.pop();
    }
    // endregion

    // region QUEUE MANAGEMENT
    /**
     * Stores currently setup render queue.
     * @param id {string} Identificator through which the stored render queue will be accessible.
     */
    storeRenderQueue(id) {
        this._storedRenderQueues[id] = this._renderQueue;
    }

    loadRenderQueue(id) {
        let queue = this._storedRenderQueues[id];

        if (queue === undefined) {
            console.error("Error: Could not find the requested queue.")
        }
        else {
            this._renderQueue = queue;
        }
    }
    // endregion
};