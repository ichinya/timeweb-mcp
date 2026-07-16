export enum FrameworksFrontend {
  ANGULAR = "angular",
  EMBER = "ember",
  NEXT_JS = "next.js",
  NUXT = "nuxt",
  PREACT = "preact",
  REACT = "react",
  SVELTE = "svelte",
  VUE = "vue",
  ANOTHER = "another",
}

export enum FrameworksBackend {
  DJANGO = "django",
  EXPRESS = "express",
  PHOENIX = "phoenix",
  SPRING = "Spring",
  LARAVEL = "laravel",
  BEEGO = "beego",
  FAST_API = "fastapi",
  ASP_DOT_NET_CORE = "ASP.NET Core",
  HAPI = "hapi",
  CELERY = "celery",
  FLASK = "flask",
  GIN = "gin",
  DOCKER = "docker",
  DOCKER_COMPOSE = "docker-compose",
  FASTIFY = "fastify",
  NEST = "nest",
  SYMFONY = "symfony",
  YII = "yii",
}

export type AppFrameworks = FrameworksBackend | FrameworksFrontend;
