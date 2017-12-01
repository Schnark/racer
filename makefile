NAME = racer
CONTENTS = i.html i.png manifest.webapp

.PHONY: all
all: $(NAME).zip $(NAME).manifest.webapp github.manifest.webapp

.PHONY: clean
clean:
	find . -name '*~' -delete

$(NAME).zip: clean $(CONTENTS)
	rm -f $(NAME).zip
	zip -r -9 $(NAME).zip $(CONTENTS)

#the sed script does the following:
#look for the line with "launch_path"
#replace it with the apropriate "package_path"
#add the size of the zip before that line
#yes, the quoting is a mess

$(NAME).manifest.webapp: manifest.webapp $(NAME).zip
	sed manifest.webapp -e '/launch_path/ {s/"launch_path"\s*:\s*"[^"]*"/"package_path":"http:\/\/localhost:8080\/$(NAME).zip"/ ; e stat --format="\\"size\\":%s," $(NAME).zip'$$'\n''}' > $(NAME).manifest.webapp

github.manifest.webapp: manifest.webapp $(NAME).zip
	sed manifest.webapp -e '/launch_path/ {s/"launch_path"\s*:\s*"[^"]*"/"package_path":"https:\/\/schnark.github.io\/$(NAME)\/$(NAME).zip"/ ; e stat --format="\\"size\\":%s," $(NAME).zip'$$'\n''}' > github.manifest.webapp
