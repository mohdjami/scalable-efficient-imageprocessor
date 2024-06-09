![Architecture and Block Diagram of my Application](public/image-readability.png "My Image Title")

# UPLOAD REDIS

# 1 /upload-redis POST

    {
        URL : "custom url with images on get request"
    }

    This route will upload the images in List(queue data structure) in the redis.

# 2 /start-worker POST

    This will start the redis worker and start dequeing the images to process them entirely.

# 2 /stop-worker POST

    Once the worker is started to process the images it will only stop when all the images are processed.
    If you want to stop it manually send a POST request to /stop-worker to stop the process

# 3 /process-single-cloud POST

        {
            URL : "custom url of image"
        }

    This will process the single image from the cloud and return the result.

# 4 /clear GET

    This will show the list of clear images till processed.

# 5 /blur GET

    This will show the list of blur images till processed.
