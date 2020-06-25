resource "local_file" "fake_file" {
  filename = "test.txt"
  content = "Hello ${random_pet.name.id}"
}

resource "random_pet" "name"{
  keepers = {
    uuid = uuid()
  }
}
